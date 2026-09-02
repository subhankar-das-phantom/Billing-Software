import { useState, useEffect, useRef, useMemo } from "react";
import {
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  Phone,
  MapPin,
  FileText,
  Package,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Calculator,
  CreditCard,
  Clock,
  ShoppingCart,
  X,
  ChevronDown,
  Loader2,
  Layers,
  Calendar,
} from "lucide-react";
import { productService } from "../../services/products/productService";
import { customerService } from "../../services/customers/customerService";
import { invoiceService } from "../../services/invoices/invoiceService";
import { formatCurrency } from "../../utils/formatters";
import {
  calculateItemAmounts,
  calculateInvoiceTotals,
  GST_RATES,
  removeGST,
  round,
} from "../../utils/calculations";
import { InvoiceCreatePageSkeleton } from "./InvoiceCreatePageSkeleton";
import Modal from "../../components/Common/Modals/Modal";
import { useToast } from "../../contexts/ToastContext";
import {
  invalidateCachePattern,
  subscribeToInvalidation,
  useDebounce,
  useFirstVisit,
  useMediaQuery,
  useStockSSE,
} from "../../hooks";
import { useQueryClient } from "@tanstack/react-query";
import InvoiceItemMobileCard from "./InvoiceItemMobileCard";
import { useAuth } from "../../contexts/AuthContext";

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

const DRAFT_STORAGE_KEY = "invoice_working_draft";

const generateCreateRequestId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `invreq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const generateRowId = (prefix = "row", id = "") => {
  const cleanId = id ? `${id}_` : "";
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${cleanId}${randomPart}`;
};

// Helper to load draft from sessionStorage (tab-specific)
const loadDraftFromStorage = () => {
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load invoice draft:", e);
  }
  return null;
};

// Helper to save draft to sessionStorage (tab-specific)
const saveDraftToStorage = (draft) => {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error("Failed to save invoice draft:", e);
  }
};

// Helper to clear draft from sessionStorage (tab-specific)
const clearDraftFromStorage = () => {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear invoice draft:", e);
  }
};

// Helper to get storage key (for debugging)
const getDraftStorageKey = () => DRAFT_STORAGE_KEY;

const getInvoiceStockAllocations = (invoice) => {
  const allocations = new Map();
  for (const item of invoice?.items || []) {
    const productId = String(item.product?._id || "");
    if (!productId) continue;
    const quantity =
      (Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0);
    allocations.set(productId, (allocations.get(productId) || 0) + quantity);
  }
  return allocations;
};

export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editInvoiceId } = useParams();
  const location = useLocation();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const isFirstVisit = useFirstVisit("invoice-create");
  const isDesktop = useMediaQuery("(min-width: 950px)");

  const { user } = useAuth();
  const enableBatchTracking = user?.preferences?.enableBatchTracking === true;

  // Detect if we're in edit mode
  const isEditMode = Boolean(
    editInvoiceId && location.pathname.includes("/edit"),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerResults, setCustomerResults] = useState([]);
  const [isCustomerSearchLoading, setIsCustomerSearchLoading] = useState(false);
  const [productResults, setProductResults] = useState([]);
  const [isProductSearchLoading, setIsProductSearchLoading] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [debouncedCustomerSearch] = useDebounce(customerSearch, 300);
  const [debouncedProductSearch] = useDebounce(productSearch, 300);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [paymentType, setPaymentType] = useState("Credit");
  const [notes, setNotes] = useState("");
  const [allocationMode, setAllocationMode] = useState("AUTO");
  const [batchModal, setBatchModal] = useState({
    open: false,
    loading: false,
    itemIndex: null,
    batches: [],
    requiredQty: 0,
    allocations: {},
  });
  const [createRequestId, setCreateRequestId] = useState(() =>
    generateCreateRequestId(),
  );

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState(null);
  const latestCustomerSearchRequest = useRef(0);
  const latestProductSearchRequest = useRef(0);
  const batchPreviewRequestRef = useRef(0);
  const batchPreviewTimersRef = useRef(new Map());
  const submitInFlightRef = useRef(false);
  const originalStockAllocationsRef = useRef(new Map());
  const invoiceItemsRef = useRef(invoiceItems);
  const loadingRef = useRef(loading);
  const savingRef = useRef(saving);
  const refreshingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isRequestCanceled = (err) =>
    err?.code === "ERR_CANCELED" ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError";

  const getCurrentEditStock = (productObj, productId) => {
    const rawVal =
      typeof productObj === "object" && productObj !== null
        ? productObj.effectiveStockQty ??
          productObj.currentStockQty ??
          productObj.currentStock ??
          0
        : productObj ?? 0;
    return (
      Math.max(0, Number(rawVal) || 0) +
      (originalStockAllocationsRef.current.get(String(productId)) || 0)
    );
  };

  const getDraftQuantityForProduct = (productId, excludedIndex = null) =>
    invoiceItems.reduce((total, item, index) => {
      if (
        index === excludedIndex ||
        String(item.product._id) !== String(productId)
      )
        return total;
      return (
        total +
        (Number(item.quantitySold) || 0) +
        (Number(item.freeQuantity) || 0)
      );
    }, 0);

  const getRemainingStockForItem = (item) =>
    Math.max(
      0,
      getCurrentEditStock(item.product, item.product._id) -
        getDraftQuantityForProduct(item.product._id),
    );

  const getMaxSoldQuantityForItem = (item, index) =>
    Math.max(
      0,
      getCurrentEditStock(item.product, item.product._id) -
        getDraftQuantityForProduct(item.product._id, index) -
        (Number(item.freeQuantity) || 0),
    );

  const getCurrentStockByProductId = async (items = []) => {
    const productIds = [
      ...new Set(items.map((item) => item?.product?._id).filter(Boolean)),
    ];
    if (productIds.length === 0) return { stockMap: new Map(), versionMap: {} };

    const stockMap = new Map();
    const versionMap = {};

    await Promise.all(
      productIds.map(async (id) => {
        try {
          const data = await productService.getProduct(id, false);
          stockMap.set(id, {
            stock:
              data?.product?.effectiveStockQty ??
              data?.product?.currentStockQty ??
              0,
            representation: data?.product?.inventoryRepresentation || "FREE",
          });
          versionMap[id] = data?.product?.stockVersion ?? 0;
        } catch {
          stockMap.set(id, { stock: 0, representation: "FREE" });
          versionMap[id] = 0;
        }
      }),
    );

    return { stockMap, versionMap };
  };

  const getCustomerById = async (customerId) => {
    if (!customerId) return null;
    try {
      const data = await customerService.getCustomer(customerId, false);
      return data?.customer || null;
    } catch {
      return null;
    }
  };

  // Save draft to sessionStorage whenever relevant state changes (works for both create and edit modes)
  useEffect(() => {
    if (!draftLoaded) return; // Don't save until draft is loaded/initialized

    const draft = {
      editInvoiceId: isEditMode ? editInvoiceId : null,
      createRequestId,
      selectedCustomer,
      customerSearch,
      invoiceItems,
      paymentType,
      notes,
      savedAt: new Date().toISOString(),
    };

    // Only save if there's meaningful data
    if (selectedCustomer || invoiceItems.length > 0 || notes) {
      saveDraftToStorage(draft);
    }
  }, [
    selectedCustomer,
    customerSearch,
    invoiceItems,
    paymentType,
    notes,
    createRequestId,
    draftLoaded,
    isEditMode,
    editInvoiceId,
  ]);

  useEffect(() => {
    loadInitialData();
  }, [editInvoiceId]);

  // Keep refs in sync with state (avoids stale closures in the stock refresh effect)
  useEffect(() => {
    invoiceItemsRef.current = invoiceItems;
  }, [invoiceItems]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // ── Real-time stock sync via SSE (cross-device) ──────────────────────────
  const sseConnectionRef = useRef("disconnected");

  const { connectionState: sseConnectionState, applyVersions } = useStockSSE({
    onStockUpdate: (updates) => {
      // Always invalidate the global products cache when ANY stock update arrives,
      // regardless of whether the product is in the current invoice draft.
      // This ensures the Product Search dropdown gets fresh stock data.
      invalidateCachePattern("products");

      setInvoiceItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const update = updates.find((u) => u.productId === item.product._id);
          if (!update) return item;
          if (
            update.effectiveStockQty === item.product.currentStock &&
            update.inventoryRepresentation ===
              item.product.inventoryRepresentation
          )
            return item;
          changed = true;
          return {
            ...item,
            product: {
              ...item.product,
              currentStock: update.effectiveStockQty,
              inventoryRepresentation: update.inventoryRepresentation,
            },
          };
        });
        return changed ? next : prev;
      });
    },
    onReconnect: async () => {
      // Version-aware reconciliation after SSE reconnect
      const items = invoiceItemsRef.current;
      if (items.length === 0) return;

      try {
        const { stockMap, versionMap } =
          await getCurrentStockByProductId(items);
        if (!isMountedRef.current) return;

        // Seed version map — applyVersions only accepts versions newer than already-known
        applyVersions(versionMap);

        setInvoiceItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            const freshData = stockMap.get(item.product._id);
            if (
              !freshData ||
              (freshData.stock === item.product.currentStock &&
                freshData.representation ===
                  item.product.inventoryRepresentation)
            )
              return item;
            changed = true;
            return {
              ...item,
              product: {
                ...item.product,
                currentStock: freshData.stock,
                inventoryRepresentation: freshData.representation,
              },
            };
          });
          return changed ? next : prev;
        });
      } catch {
        // Silent fail — reconciliation is best-effort
      }
    },
    enabled: true,
  });

  // Keep a ref of connectionState for use in the refreshStock closure
  useEffect(() => {
    sseConnectionRef.current = sseConnectionState;
  }, [sseConnectionState]);

  // Refresh stock when products are invalidated (cross-tab) or tab regains focus (cross-device fallback)
  useEffect(() => {
    isMountedRef.current = true;

    const refreshStock = async () => {
      const items = invoiceItemsRef.current;
      if (items.length === 0) return;
      if (loadingRef.current || savingRef.current) return;
      if (refreshingRef.current) return;

      refreshingRef.current = true;

      try {
        const { stockMap, versionMap } =
          await getCurrentStockByProductId(items);

        if (!isMountedRef.current) return;

        // Seed version map for SSE ordering
        applyVersions(versionMap);

        setInvoiceItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            const freshData = stockMap.get(item.product._id);
            if (
              !freshData ||
              (freshData.stock === item.product.currentStock &&
                freshData.representation ===
                  item.product.inventoryRepresentation)
            )
              return item;
            changed = true;
            return {
              ...item,
              product: {
                ...item.product,
                currentStock: freshData.stock,
                inventoryRepresentation: freshData.representation,
              },
            };
          });
          return changed ? next : prev;
        });
      } catch {
        // Silent fail — stale stock is better than crashing
      } finally {
        refreshingRef.current = false;
      }
    };

    // 1. Cross-tab invalidation via centralized subscription
    const unsubscribe = subscribeToInvalidation("products", refreshStock);

    // 2. Cross-device fallback: refresh on tab focus ONLY when SSE is disconnected
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        sseConnectionRef.current !== "connected"
      ) {
        refreshStock();
      }
    };
    const handleFocus = () => {
      if (sseConnectionRef.current !== "connected") {
        refreshStock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      for (const timer of batchPreviewTimersRef.current.values()) {
        clearTimeout(timer);
      }
      batchPreviewTimersRef.current.clear();
      batchPreviewRequestRef.current += 1;

      isMountedRef.current = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const query = debouncedCustomerSearch.trim();
    const abortController = new AbortController();

    if (!showCustomerDropdown) return;

    if (query.length < 1) {
      setCustomerResults([]);
      setIsCustomerSearchLoading(false);
      return;
    }

    const requestId = latestCustomerSearchRequest.current + 1;
    latestCustomerSearchRequest.current = requestId;
    setIsCustomerSearchLoading(true);

    (async () => {
      try {
        const data = await customerService.getCustomers(
          {
            search: query,
            limit: 10,
            page: 1,
            includeInactive: true,
          },
          {
            signal: abortController.signal,
          },
        );

        if (latestCustomerSearchRequest.current !== requestId) return;
        setCustomerResults(data.customers || []);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        if (latestCustomerSearchRequest.current !== requestId) return;
        setCustomerResults([]);
      } finally {
        if (latestCustomerSearchRequest.current === requestId) {
          setIsCustomerSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedCustomerSearch, showCustomerDropdown]);

  useEffect(() => {
    const query = debouncedProductSearch.trim();
    const abortController = new AbortController();

    if (!showProductDropdown) return;

    if (query.length < 1) {
      setProductResults([]);
      setIsProductSearchLoading(false);
      return;
    }

    const requestId = latestProductSearchRequest.current + 1;
    latestProductSearchRequest.current = requestId;
    setIsProductSearchLoading(true);

    (async () => {
      try {
        const data = await productService.getProducts(
          {
            search: query,
            limit: 22,
            page: 1,
          },
          {
            signal: abortController.signal,
          },
        );

        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults(data.products || []);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        if (latestProductSearchRequest.current !== requestId) return;
        setProductResults([]);
      } finally {
        if (latestProductSearchRequest.current === requestId) {
          setIsProductSearchLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [debouncedProductSearch, showProductDropdown]);

  const loadInitialData = async () => {
    try {
      // During an edit, product.currentStockQty already excludes this invoice's
      // original allocation. Keep that allocation as the edit-session baseline.
      let editInvoice = null;
      if (isEditMode) {
        try {
          const invoiceData = await invoiceService.getInvoice(
            editInvoiceId,
            false,
          );
          editInvoice = invoiceData.invoice;
          originalStockAllocationsRef.current =
            getInvoiceStockAllocations(editInvoice);
          setOriginalInvoice(editInvoice);
        } catch {
          error("Failed to load invoice for editing");
          navigate("/invoices");
          return;
        }
      } else {
        originalStockAllocationsRef.current = new Map();
        setOriginalInvoice(null);
      }

      // Load saved draft (works for both create and edit modes)
      const savedDraft = loadDraftFromStorage();
      console.log("Draft key:", getDraftStorageKey());
      console.log("Loaded draft:", savedDraft);

      if (savedDraft?.createRequestId) {
        setCreateRequestId(savedDraft.createRequestId);
      }

      // Check if we have a valid draft with items
      if (savedDraft && savedDraft.invoiceItems?.length > 0) {
        // If we're in edit mode via URL, make sure the draft matches this invoice
        // Or if we're in create mode, check if draft has an edit session
        const draftIsForThisEdit =
          isEditMode && savedDraft.editInvoiceId === editInvoiceId;
        const draftIsEdit = savedDraft.editInvoiceId != null;

        if (isEditMode && draftIsForThisEdit) {
          // Editing this specific invoice - restore the draft
          console.log("Restoring edit draft for invoice:", editInvoiceId);
          if (savedDraft.selectedCustomer) {
            setSelectedCustomer(savedDraft.selectedCustomer);
            setCustomerSearch(
              savedDraft.customerSearch ||
                savedDraft.selectedCustomer.customerName,
            );
          }

          const { stockMap } = await getCurrentStockByProductId(
            savedDraft.invoiceItems,
          );

          const restoredItems = savedDraft.invoiceItems.map((item) => {
            const currentStockData = stockMap.get(item.product._id);
            return {
              _rowId: item._rowId || generateRowId("restored", item.product?._id),
              ...item,
              product: {
                ...item.product,
                // Keep live database stock separate from the original invoice
                // allocation. The available quantity is derived while editing.
                currentStock: currentStockData?.stock ?? 0,
                inventoryRepresentation:
                  currentStockData?.representation || "FREE",
              },
            };
          });
          setInvoiceItems(restoredItems);

          if (savedDraft.paymentType) setPaymentType(savedDraft.paymentType);
          if (savedDraft.notes !== undefined) setNotes(savedDraft.notes);

          success("Edit draft restored");
        } else if (!isEditMode && draftIsEdit) {
          // We're on create page but draft has edit session - redirect to edit page
          console.log("Redirecting to edit page:", savedDraft.editInvoiceId);
          navigate(`/invoices/${savedDraft.editInvoiceId}/edit`);
          return;
        } else if (!isEditMode && !draftIsEdit) {
          // Regular create draft on create page - restore it
          console.log("Restoring create draft");
          if (savedDraft.selectedCustomer) {
            const customer = await getCustomerById(
              savedDraft.selectedCustomer._id,
            );
            if (customer) {
              setSelectedCustomer(customer);
              setCustomerSearch(
                savedDraft.customerSearch || customer.customerName,
              );
            } else {
              setSelectedCustomer(savedDraft.selectedCustomer);
              setCustomerSearch(
                savedDraft.customerSearch ||
                  savedDraft.selectedCustomer.customerName,
              );
            }
          }

          if (savedDraft.invoiceItems && savedDraft.invoiceItems.length > 0) {
            const { stockMap } = await getCurrentStockByProductId(
              savedDraft.invoiceItems,
            );
            const validItems = savedDraft.invoiceItems
              .filter((item) => {
                const data = stockMap.get(item.product._id);
                return (data?.stock ?? 0) > 0;
              })
              .map((item) => {
                const data = stockMap.get(item.product._id);
                return {
                  _rowId: item._rowId || generateRowId("restored", item.product?._id),
                  ...item,
                  product: {
                    ...item.product,
                    currentStock: data?.stock ?? 0,
                    inventoryRepresentation: data?.representation || "FREE",
                  },
                };
              });
            setInvoiceItems(validItems);
          }

          if (savedDraft.paymentType) setPaymentType(savedDraft.paymentType);
          if (savedDraft.notes) setNotes(savedDraft.notes);

          success("Draft restored");
        } else if (isEditMode && !draftIsForThisEdit) {
          // Edit mode but draft is for different invoice or is a create draft - load from database
          console.log("Loading invoice from database:", editInvoiceId);
          try {
            const invoice = editInvoice;
            const { stockMap } = await getCurrentStockByProductId(
              invoice.items,
            );

            setSelectedCustomer(invoice.customer);
            setCustomerSearch(invoice.customer.customerName);

            const loadedItems = invoice.items.map((item) => {
              const currentStockData = stockMap.get(item.product._id);
              const baseRate = item.ratePerUnit;
              const amounts = calculateItemAmounts(
                item.quantitySold,
                baseRate,
                item.product.gstPercentage,
                item.schemeDiscount || 0,
              );

              return {
                _rowId: item._rowId || generateRowId("edit", item.product?._id),
                product: {
                  ...item.product,
                  rate: item.product.newMRP,
                  currentStock: currentStockData?.stock ?? 0,
                  inventoryRepresentation:
                    currentStockData?.representation || "FREE",
                },
                quantitySold: item.quantitySold,
                freeQuantity: item.freeQuantity || 0,
                baseRate: baseRate,
                netRate: round(
                  baseRate * (1 + item.product.gstPercentage / 100),
                  2,
                ),
                schemeDiscount: item.schemeDiscount || 0,
                manualAllocations: item.batchAllocations?.map((allocation) => ({
                  batchId: allocation.batchId,
                  quantity: allocation.quantity,
                })),
                ...amounts,
              };
            });
            setInvoiceItems(loadedItems);

            setPaymentType(invoice.paymentType || "Credit");
            setNotes(invoice.notes || "");
          } catch {
            error("Failed to load invoice for editing");
            navigate("/invoices");
            return;
          }
        }
      } else if (isEditMode) {
        // Edit mode with no draft at all - load from database
        console.log(
          "No draft found, loading invoice from database:",
          editInvoiceId,
        );
        try {
          const invoice = editInvoice;
          const { stockMap } = await getCurrentStockByProductId(invoice.items);

          setSelectedCustomer(invoice.customer);
          setCustomerSearch(invoice.customer.customerName);

          const loadedItems = invoice.items.map((item) => {
            const currentStockData = stockMap.get(item.product._id);
            const baseRate = item.ratePerUnit;
            const amounts = calculateItemAmounts(
              item.quantitySold,
              baseRate,
              item.product.gstPercentage,
              item.schemeDiscount || 0,
            );

            return {
              _rowId: item._rowId || generateRowId("edit", item.product?._id),
              product: {
                ...item.product,
                rate: item.product.newMRP,
                currentStock: currentStockData?.stock ?? 0,
                inventoryRepresentation:
                  currentStockData?.representation || "FREE",
              },
              quantitySold: item.quantitySold,
              freeQuantity: item.freeQuantity || 0,
              baseRate: baseRate,
              netRate: round(
                baseRate * (1 + item.product.gstPercentage / 100),
                2,
              ),
              schemeDiscount: item.schemeDiscount || 0,
              manualAllocations: item.batchAllocations?.map((allocation) => ({
                batchId: allocation.batchId,
                quantity: allocation.quantity,
              })),
              ...amounts,
            };
          });
          setInvoiceItems(loadedItems);

          setPaymentType(invoice.paymentType || "Credit");
          setNotes(invoice.notes || "");
        } catch {
          error("Failed to load invoice for editing");
          navigate("/invoices");
          return;
        }
      } else {
        // Create mode with no draft - check for customer from URL params
        const customerId = searchParams.get("customer");
        if (customerId) {
          const customer = await getCustomerById(customerId);
          if (customer) {
            setSelectedCustomer(customer);
            setCustomerSearch(customer.customerName);
          }
        }
      }
    } catch {
      error("Failed to load data");
    } finally {
      setLoading(false);
      setDraftLoaded(true); // Mark as loaded to enable auto-save
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.customerName);
    setCustomerResults([]);
    setShowCustomerDropdown(false);
  };

  const getBatchPricingKey = (batch) => {
    const rate = Number(batch?.rate ?? 0);
    const mrp = Number(batch?.mrp ?? 0);
    const gstPercent = Number(
      batch?.gstPercent ?? batch?.gstPercentage ?? 0,
    );
    return `${rate}|${mrp}|${gstPercent}`;
  };

  const buildItemFromBatchAllocation = ({
    sourceItem,
    batch,
    quantitySold,
    freeQuantity,
    batchIds = [],
    manualAllocations,
  }) => {
    const rate = Number(batch?.rate ?? sourceItem.product?.rate ?? 0);
    const mrp = Number(batch?.mrp ?? sourceItem.product?.newMRP ?? 0);
    const gstPercent = Number(
      batch?.gstPercent ?? sourceItem.product?.gstPercentage ?? 0,
    );
    const baseRate = round(removeGST(rate, gstPercent), 2);
    const amounts = calculateItemAmounts(
      quantitySold,
      baseRate,
      gstPercent,
      sourceItem.schemeDiscount || 0,
    );

    const batchNo =
      batch?.batchNo ||
      batch?.batchNumber ||
      (batch?._id === "UNNAMED" ? "UNNAMED" : "No Batch #");

    const batchIdStr = batch?._id
      ? String(batch._id)
      : batch?.id
        ? String(batch.id)
        : null;
    const pricingKey = getBatchPricingKey(batch);
    const rawProdId =
      sourceItem?.product?._id || sourceItem?.product?.id || sourceItem?.product;
    const prodIdStr =
      typeof rawProdId === "object"
        ? String(rawProdId?._id || rawProdId?.id || rawProdId)
        : String(rawProdId);

    return {
      ...sourceItem,
      _rowId:
        sourceItem?._rowId && sourceItem._batchId === batchIdStr
          ? sourceItem._rowId
          : generateRowId("batch", `${prodIdStr}_${batchIdStr || "unnamed"}`),
      product: {
        ...sourceItem.product,
        batchNo: batchNo || sourceItem.product?.batchNo || "No Batch #",
        newMRP: mrp,
        rate,
        gstPercentage: gstPercent,
      },
      batchNo: batchNo || sourceItem.batchNo || "No Batch #",
      quantitySold,
      freeQuantity,
      baseRate,
      netRate: round(baseRate * (1 + gstPercent / 100), 2),
      ...(manualAllocations ? { manualAllocations } : {}),
      ...(batchIds.length > 0 ? { _batchIds: batchIds } : {}),
      ...amounts,
      _batchId: batchIdStr,
      _batchKey: `${batchIdStr || "batch"}|${pricingKey}`,
      _batchPreview: true,
    };
  };

  const simulateBatchAllocation = async (
    product,
    requestedQuantity,
    sourceItem = null,
  ) => {
    const quantity = Math.max(0, Number(requestedQuantity) || 0);
    if (quantity <= 0) return [];

    const rawId = product?._id || product?.id || product;
    const productIdStr = typeof rawId === "object" ? String(rawId?._id || rawId?.id || rawId) : String(rawId);

    const data = await productService.getBatches(productIdStr);
    const batches = [...(data?.batches || [])]
      .filter((batch) => (Number(batch.remainingQty) || 0) > 0)
      .sort((a, b) => {
        const aExpiry = a.expiryDate
          ? new Date(a.expiryDate).getTime()
          : Number.POSITIVE_INFINITY;
        const bExpiry = b.expiryDate
          ? new Date(b.expiryDate).getTime()
          : Number.POSITIVE_INFINITY;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aCreated - bCreated;
      });

    let remaining = quantity;
    const allocations = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = Math.max(0, Number(batch.remainingQty) || 0);
      const allocated = Math.min(remaining, available);
      if (allocated <= 0) continue;
      allocations.push({ batch, quantity: allocated });
      remaining -= allocated;
    }

    if (remaining > 0) {
      allocations.push({
        batch: {
          _id: "UNNAMED",
          batchNumber: "UNNAMED",
          mfgDate: null,
          expiryDate: null,
          rate: product.rate || 0,
          mrp: product.newMRP || product.rate || 0,
          gstPercent: product.gstPercentage || 0,
          purchaseRate: product.rate || 0,
          remainingQty: remaining,
        },
        quantity: remaining,
      });
      remaining = 0;
    }

    let soldRemaining = Number(sourceItem?.quantitySold ?? quantity);
    let freeRemaining = Number(sourceItem?.freeQuantity ?? 0);
    const grouped = new Map();

    for (let i = 0; i < allocations.length; i++) {
      const allocation = allocations[i];
      const b = allocation.batch;
      const bId = b?._id ? String(b._id) : (b?.id ? String(b.id) : `batch_${i}`);
      const pricingKey = `${bId}|${getBatchPricingKey(b)}`;
      const soldForBatch = Math.min(soldRemaining, allocation.quantity);
      const remainingForFree = allocation.quantity - soldForBatch;
      const freeForBatch = Math.min(freeRemaining, remainingForFree);

      soldRemaining -= soldForBatch;
      freeRemaining -= freeForBatch;

      const existing = grouped.get(pricingKey);
      if (existing) {
        existing.quantity += allocation.quantity;
        existing.quantitySold += soldForBatch;
        existing.freeQuantity += freeForBatch;
        existing.batchIds.push(allocation.batch._id);
        existing.manualAllocations.push({
          batchId: allocation.batch._id,
          quantity: allocation.quantity,
        });
      } else {
        grouped.set(pricingKey, {
          batch: allocation.batch,
          quantity: allocation.quantity,
          quantitySold: soldForBatch,
          freeQuantity: freeForBatch,
          batchIds: [allocation.batch._id],
          manualAllocations: [
            { batchId: allocation.batch._id, quantity: allocation.quantity },
          ],
        });
      }
    }

    return [...grouped.values()].map((group, groupIdx) => {
      const item = buildItemFromBatchAllocation({
        sourceItem: sourceItem || {
          product,
          quantitySold: group.quantitySold,
          freeQuantity: group.freeQuantity,
          schemeDiscount: 0,
        },
        batch: group.batch,
        quantitySold: group.quantitySold,
        freeQuantity: group.freeQuantity,
        batchIds: group.batchIds,
        manualAllocations: group.manualAllocations,
      });
      // If expanding from an existing sourceItem, only the first allocation preserves sourceItem._rowId
      // Subsequent allocations must get a freshly generated unique _rowId to avoid key duplication
      if (groupIdx === 0 && sourceItem?._rowId) {
        item._rowId = sourceItem._rowId;
      } else {
        item._rowId = generateRowId(
          "batch",
          `${productIdStr}_${group.batch?._id || "unnamed"}`,
        );
      }
      return item;
    });
  };

  const scheduleBatchPreview = (
    product,
    requestedQuantity,
    sourceItem,
    immediate = false,
  ) => {
    const rawId = product?._id || product?.id || product;
    const productId =
      typeof rawId === "object"
        ? String(rawId?._id || rawId?.id || rawId)
        : String(rawId);
    const previousTimer = batchPreviewTimersRef.current.get(productId);
    if (previousTimer) clearTimeout(previousTimer);

    if (requestedQuantity <= 0) {
      setInvoiceItems((prev) =>
        prev.map((item) =>
          String(item.product?._id || item.product?.id || item.product) ===
          productId
            ? { ...item, _batchPreviewPending: false }
            : item,
        ),
      );
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++batchPreviewRequestRef.current;
      try {
        const rows = await simulateBatchAllocation(
          product,
          requestedQuantity,
          sourceItem,
        );
        if (requestId !== batchPreviewRequestRef.current) return;
        if (!isMountedRef.current) return;

        setInvoiceItems((prev) => {
          const rawId = product?._id || product?.id || product;
          const productIdString =
            typeof rawId === "object"
              ? String(rawId?._id || rawId?.id || rawId)
              : String(rawId);

          const firstIndex = prev.findIndex(
            (item) =>
              String(item.product?._id || item.product?.id || item.product) ===
              productIdString,
          );

          if (firstIndex === -1) return prev;

          // Safety guard: if rows is empty, NEVER delete the item!
          if (!rows || rows.length === 0) {
            return prev.map((item) =>
              String(item.product?._id || item.product?.id || item.product) ===
              productIdString
                ? { ...item, _batchPreviewPending: false }
                : item,
            );
          }

          const next = prev.filter(
            (item) =>
              String(item.product?._id || item.product?.id || item.product) !==
              productIdString,
          );

          const oldItems = prev.filter(
            (item) =>
              String(item.product?._id || item.product?.id || item.product) ===
              productIdString,
          );

          const usedOldRowIds = new Set();

          const mergedRows = rows.map((newRow) => {
            const oldRow =
              oldItems.find(
                (old) =>
                  old._batchId === newRow._batchId &&
                  old._rowId &&
                  !usedOldRowIds.has(old._rowId),
              ) ||
              (oldItems.length === 1 && !usedOldRowIds.has(oldItems[0]._rowId)
                ? oldItems[0]
                : null);

            if (oldRow) {
              newRow._rowId = oldRow._rowId;
              usedOldRowIds.add(oldRow._rowId);
              newRow.schemeDiscount = oldRow.schemeDiscount || 0;
              if (oldRow.baseRate !== undefined)
                newRow.baseRate = oldRow.baseRate;
              if (oldRow.netRate !== undefined)
                newRow.netRate = oldRow.netRate;

              const amounts = calculateItemAmounts(
                newRow.quantitySold,
                newRow.baseRate,
                newRow.product.gstPercentage,
                newRow.schemeDiscount,
              );
              return { ...newRow, ...amounts };
            }
            if (!newRow._rowId || usedOldRowIds.has(newRow._rowId)) {
              newRow._rowId = generateRowId(
                "batch",
                `${productIdString}_${newRow._batchId || "unnamed"}`,
              );
            }
            usedOldRowIds.add(newRow._rowId);
            return newRow;
          });

          const insertIndex =
            firstIndex !== -1 ? Math.min(firstIndex, next.length) : 0;
          next.splice(insertIndex, 0, ...mergedRows);
          return next;
        });
      } catch (err) {
        if (requestId !== batchPreviewRequestRef.current) return;
        if (!isMountedRef.current) return;
        error(err.message || "Failed to preview batch allocation");
      } finally {
        if (batchPreviewTimersRef.current.get(productId) === timer) {
          batchPreviewTimersRef.current.delete(productId);
        }
      }
    }, immediate ? 0 : 150);
    batchPreviewTimersRef.current.set(productId, timer);
  };

  const createBaseInvoiceItem = (product) => {
    const baseRate = removeGST(product.rate, product.gstPercentage);
    const amounts = calculateItemAmounts(1, baseRate, product.gstPercentage, 0);
    const rawId = product?._id || product?.id || product;
    const productIdString =
      typeof rawId === "object"
        ? String(rawId?._id || rawId?.id || rawId)
        : String(rawId);

    return {
      _rowId: generateRowId("base", productIdString),
      product: {
        _id: productIdString,
        productName: product.productName,
        hsnCode: product.hsnCode,
        newMRP: product.newMRP,
        rate: product.rate,
        gstPercentage: product.gstPercentage,
        currentStock:
          product.effectiveStockQty ??
          product.currentStockQty ??
          product.currentStock ??
          0,
        inventoryRepresentation: product.inventoryRepresentation || "FREE",
      },
      quantitySold: 1,
      freeQuantity: 0,
      baseRate: round(baseRate, 2),
      netRate: round(baseRate * (1 + product.gstPercentage / 100), 2),
      schemeDiscount: 0,
      ...amounts,
    };
  };

  const handleProductSelect = (product) => {
    const rawId = product?._id || product?.id || product;
    const productIdString =
      typeof rawId === "object"
        ? String(rawId?._id || rawId?.id || rawId)
        : String(rawId);

    // 1. Close dropdown and clear search immediately
    setProductSearch("");
    setProductResults([]);
    setShowProductDropdown(false);

    // 2. Check if product already exists in the invoice items
    const existingIndex = invoiceItems.findIndex(
      (item) =>
        String(item.product?._id || item.product?.id || item.product) ===
        productIdString,
    );

    if (existingIndex !== -1) {
      const existingItem = invoiceItems[existingIndex];
      const currentQty = Number(existingItem.quantitySold) || 0;
      updateItemQuantity(existingIndex, "quantitySold", currentQty + 1);
      return;
    }

    // 3. Optimistically insert base item IMMEDIATELY (0ms UI latency!)
    const baseItem = createBaseInvoiceItem(product);
    if (enableBatchTracking && allocationMode === "AUTO") {
      baseItem._batchPreviewPending = true;
    }
    setInvoiceItems((prev) => [baseItem, ...prev]);

    // 4. If AUTO batch tracking is active, resolve FIFO allocation immediately in background
    if (enableBatchTracking && allocationMode === "AUTO") {
      scheduleBatchPreview(product, 1, baseItem, true);
    }
  };

  const updateItemQuantity = (index, field, value) => {
    if (
      enableBatchTracking &&
      allocationMode === "AUTO" &&
      (field === "quantitySold" || field === "freeQuantity")
    ) {
      const updated = [...invoiceItems];
      const changedItem = { ...updated[index] };
      const isEmpty = value === "";
      let newValue = parseFloat(value);
      if (Number.isNaN(newValue)) newValue = 0;

      const productId = String(changedItem.product._id);
      const otherQuantity = updated.reduce(
        (total, existing, existingIndex) => {
          if (
            existingIndex === index ||
            String(existing.product._id) !== productId
          )
            return total;
          return (
            total +
            (Number(existing.quantitySold) || 0) +
            (Number(existing.freeQuantity) || 0)
          );
        },
        0,
      );

      const stockLimit = getCurrentEditStock(
        changedItem.product,
        changedItem.product._id,
      );
      const currentSold =
        field === "quantitySold"
          ? Math.max(0, newValue)
          : Number(changedItem.quantitySold) || 0;
      const currentFree =
        field === "freeQuantity"
          ? Math.max(0, newValue)
          : Number(changedItem.freeQuantity) || 0;
      let groupQuantity = currentSold + currentFree + otherQuantity;

      if (groupQuantity > stockLimit) {
        const excess = groupQuantity - stockLimit;
        if (field === "freeQuantity") {
          newValue = Math.max(0, currentFree - excess);
        } else {
          newValue = Math.max(0, currentSold - excess);
        }
      }

      if (field === "quantitySold") {
        changedItem.quantitySold = isEmpty ? "" : Math.max(0, newValue);
      } else {
        changedItem.freeQuantity = isEmpty ? "" : Math.max(0, newValue);
      }

      const amounts = calculateItemAmounts(
        Number(changedItem.quantitySold) || 0,
        changedItem.baseRate,
        changedItem.product.gstPercentage,
        changedItem.schemeDiscount,
      );
      updated[index] = {
        ...changedItem,
        ...amounts,
        netRate: round(
          changedItem.baseRate *
            (1 + changedItem.product.gstPercentage / 100),
          2,
        ),
      };

      const nextSnapshot = {
        product: changedItem.product,
        quantitySold: updated
          .filter((item) => String(item.product._id) === productId)
          .reduce((sum, item) => sum + (Number(item.quantitySold) || 0), 0),
        freeQuantity: updated
          .filter((item) => String(item.product._id) === productId)
          .reduce((sum, item) => sum + (Number(item.freeQuantity) || 0), 0),
        schemeDiscount: changedItem.schemeDiscount || 0,
      };

      const totalRequested =
        nextSnapshot.quantitySold + nextSnapshot.freeQuantity;

      if (totalRequested <= 0) {
        // User cleared quantity (backspace) or set to 0.
        // Retain the item row without deleting it, and cancel any pending batch simulation.
        updated[index]._batchPreviewPending = false;
        const previousTimer = batchPreviewTimersRef.current.get(productId);
        if (previousTimer) clearTimeout(previousTimer);
        setInvoiceItems(updated);
        return;
      }

      updated[index]._batchPreviewPending = true;
      setInvoiceItems(updated);

      scheduleBatchPreview(
        nextSnapshot.product,
        totalRequested,
        nextSnapshot,
      );
      return;
    }

    setInvoiceItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const isEmpty = value === "";
      let newValue = parseFloat(value);
      if (Number.isNaN(newValue)) newValue = 0;

      // A line can use the database stock plus this invoice's original allocation.
      // Recalculate it from the current draft so decreasing a line immediately
      // releases that stock for the rest of the edit session.
      const maxStock = getCurrentEditStock(
        item.product,
        item.product._id,
      );
      const quantityInOtherLines = updated.reduce(
        (total, existingItem, existingIndex) => {
          if (
            existingIndex === index ||
            String(existingItem.product._id) !== String(item.product._id)
          )
            return total;
          return (
            total +
            (Number(existingItem.quantitySold) || 0) +
            (Number(existingItem.freeQuantity) || 0)
          );
        },
        0,
      );
      const remainingForLine = Math.max(0, maxStock - quantityInOtherLines);
      if (field === "quantitySold") {
        const maxAllowed = remainingForLine - (Number(item.freeQuantity) || 0);
        newValue = Math.min(Math.max(0, newValue), Math.max(0, maxAllowed));
        item.quantitySold = isEmpty ? "" : newValue;
      } else if (field === "freeQuantity") {
        const maxAllowed = remainingForLine - (Number(item.quantitySold) || 0);
        newValue = Math.min(Math.max(0, newValue), Math.max(0, maxAllowed));
        item.freeQuantity = isEmpty ? "" : newValue;
      }

      if (
        enableBatchTracking &&
        allocationMode === "MANUAL" &&
        (field === "quantitySold" || field === "freeQuantity")
      ) {
        item.manualAllocations = undefined;
      }

      // If user is changing totalAmount, recalculate baseRate
      if (field === "totalAmount") {
        item.totalAmount = newValue;
        // Work backwards: totalAmount = taxable + gst = taxable * (1 + gstPercentage/100)
        // And taxable = baseRate * qty * (1 - discount/100)
        // So: totalAmount = baseRate * qty * (1 - discount/100) * (1 + gstPercentage/100)
        const qty = Number(item.quantitySold) || 1;
        const discountMultiplier = (100 - (item.schemeDiscount || 0)) / 100;
        const gstMultiplier = (100 + item.product.gstPercentage) / 100;

        if (qty > 0 && discountMultiplier > 0) {
          item.baseRate = round(
            newValue / (qty * discountMultiplier * gstMultiplier),
            2,
          );
        }

        // Recalculate other amounts based on new baseRate
        const amounts = calculateItemAmounts(
          Number(item.quantitySold) || 0,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount,
        );
        // But keep the user-entered totalAmount
        updated[index] = { ...item, ...amounts, totalAmount: newValue };
      } else if (field === "netRate") {
        // Store raw string value to preserve decimal point while typing (e.g. "15." before user types "50")
        item.netRate = value;

        // Only recalculate if we have a valid, complete number (not ending with '.' or empty)
        const parsed = parseFloat(value);
        if (
          value !== "" &&
          !String(value).endsWith(".") &&
          !isNaN(parsed) &&
          parsed > 0
        ) {
          // Net Rate = baseRate * (1 + gst/100), so baseRate = netRate / (1 + gst/100)
          const gstMultiplier = (100 + item.product.gstPercentage) / 100;
          item.baseRate = round(parsed / gstMultiplier, 2);

          // Recalculate all amounts based on new baseRate
          const amounts = calculateItemAmounts(
            Number(item.quantitySold) || 0,
            item.baseRate,
            item.product.gstPercentage,
            item.schemeDiscount,
          );
          updated[index] = { ...item, ...amounts, netRate: value };
        } else {
          updated[index] = { ...item, netRate: value };
        }
      } else if (field === "baseAmount") {
        // baseAmount = baseRate * qty, so baseRate = baseAmount / qty
        const qty = Number(item.quantitySold) || 1;
        item.baseRate = round(newValue / qty, 2);
        item.baseAmount = newValue;

        // Recalculate all amounts based on new baseRate
        const amounts = calculateItemAmounts(
          Number(item.quantitySold) || 0,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount,
        );
        // Keep the user-entered baseAmount but update netRate
        const netRate = round(
          item.baseRate * (1 + item.product.gstPercentage / 100),
          2,
        );
        updated[index] = { ...item, ...amounts, baseAmount: newValue, netRate };
      } else {
        if (field !== "quantitySold" && field !== "freeQuantity") {
          item[field] = newValue;
        }

        // Use baseRate for calculations (this is the rate without GST)
        const amounts2 = calculateItemAmounts(
          Number(item.quantitySold) || 0,
          item.baseRate,
          item.product.gstPercentage,
          item.schemeDiscount,
        );

        updated[index] = {
          ...item,
          ...amounts2,
          netRate: round(
            item.baseRate * (1 + item.product.gstPercentage / 100),
            2,
          ),
        };
      }

      return updated;
    });
  };

  const removeItem = (index) => {
    setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const openBatchModal = async (index, item) => {
    const requiredQty =
      (Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0);

    const initialAllocations = {};
    if (item.manualAllocations) {
      item.manualAllocations.forEach((a) => {
        initialAllocations[a.batchId] = a.quantity;
      });
    }

    // Open modal immediately so user gets instant 0ms UI response
    setBatchModal({
      open: true,
      loading: true,
      itemIndex: index,
      batches: [],
      requiredQty,
      allocations: initialAllocations,
    });

    try {
      const data = await productService.getBatches(item.product._id);
      setBatchModal((prev) => {
        if (!prev.open || prev.itemIndex !== index) return prev;
        return {
          ...prev,
          loading: false,
          batches: data.batches || [],
        };
      });
    } catch (err) {
      setBatchModal((prev) => ({ ...prev, loading: false }));
      error("Failed to load batches");
    }
  };

  const saveBatchAllocations = () => {
    const allocatedTotal = Object.values(batchModal.allocations).reduce(
      (sum, q) => sum + (parseInt(q, 10) || 0),
      0,
    );
    if (allocatedTotal !== batchModal.requiredQty) {
      error(
        `Total allocated quantity (${allocatedTotal}) must equal required quantity (${batchModal.requiredQty})`,
      );
      return;
    }

    const selectedAllocations = Object.entries(batchModal.allocations)
      .map(([batchId, quantity]) => ({
        batchId,
        quantity: parseInt(quantity, 10),
      }))
      .filter((a) => a.quantity > 0);

    const item = invoiceItems[batchModal.itemIndex];
    const batchById = new Map(
      batchModal.batches.map((batch) => [String(batch._id), batch]),
    );
    const grouped = new Map();

    for (const allocation of selectedAllocations) {
      const batch = batchById.get(String(allocation.batchId));
      if (!batch) continue;
      const pricingKey = getBatchPricingKey(batch);
      const existing = grouped.get(pricingKey);
      if (existing) {
        existing.quantity += allocation.quantity;
        existing.batchIds.push(batch._id);
        existing.manualAllocations.push(allocation);
      } else {
        grouped.set(pricingKey, {
          batch,
          quantity: allocation.quantity,
          batchIds: [batch._id],
          manualAllocations: [allocation],
        });
      }
    }

    let soldRemaining = Number(item.quantitySold) || 0;
    let freeRemaining = Number(item.freeQuantity) || 0;

    const replacementRows = [...grouped.values()].map((group, gIdx) => {
      const quantitySold = Math.min(soldRemaining, group.quantity);
      soldRemaining -= quantitySold;
      const freeQuantity = Math.min(
        freeRemaining,
        group.quantity - quantitySold,
      );
      freeRemaining -= freeQuantity;

      const repItem = buildItemFromBatchAllocation({
        sourceItem: item,
        batch: group.batch,
        quantitySold,
        freeQuantity,
        batchIds: group.batchIds,
        manualAllocations: group.manualAllocations,
      });

      repItem._rowId =
        gIdx === 0 && item._rowId
          ? item._rowId
          : generateRowId(
              "batch",
              `${item.product?._id || "prod"}_${group.batch?._id || "unnamed"}`,
            );
      return repItem;
    });

    setInvoiceItems((prev) => {
      const next = [...prev];
      next.splice(batchModal.itemIndex, 1, ...replacementRows);
      return next;
    });

    setBatchModal((prev) => ({ ...prev, open: false }));
    success("Batch allocations saved");
  };

  // Use useMemo to ensure totals recalculate when invoiceItems changes
  const totals = useMemo(() => {
    try {
      return calculateInvoiceTotals(invoiceItems);
    } catch (err) {
      console.error("Error calculating totals:", err);
      return {
        baseAmount: 0,
        totalDiscount: 0,
        totalTaxable: 0,
        totalCGST: 0,
        totalSGST: 0,
        netTotal: 0,
      };
    }
  }, [invoiceItems]);

  const validateInvoice = () => {
    if (!selectedCustomer) {
      error("Please select a customer");
      return false;
    }
    if (invoiceItems.length === 0) {
      error("Please add at least one product");
      return false;
    }
    const allocatedByProduct = new Map();
    for (const item of invoiceItems) {
      const productId = String(item.product._id);
      const totalQty =
        (Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0);
      const allocated = (allocatedByProduct.get(productId) || 0) + totalQty;
      const maximumForProduct = getCurrentEditStock(
        item.product.currentStock,
        productId,
      );
      if (allocated > maximumForProduct) {
        error(`Insufficient stock for ${item.product.productName}`);
        return false;
      }

      if (enableBatchTracking && allocationMode === "MANUAL") {
        const batchAllocated = (item.manualAllocations || []).reduce(
          (sum, a) => sum + a.quantity,
          0,
        );
        if (batchAllocated !== totalQty) {
          error(
            `Please complete manual batch allocation for ${item.product.productName}`,
          );
          return false;
        }
      }
      allocatedByProduct.set(productId, allocated);
    }
    return true;
  };

  const handleSubmit = async () => {
    if (saving || submitInFlightRef.current) return;
    if (!validateInvoice()) return;

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const invoiceData = {
        customerId: selectedCustomer._id,
        items: invoiceItems.map((item) => {
          const mappedItem = {
            productId: item.product._id,
            quantitySold: item.quantitySold,
            freeQuantity: item.freeQuantity,
            ratePerUnit: item.baseRate,
            schemeDiscount: item.schemeDiscount,
          };
          if (enableBatchTracking) {
            mappedItem.allocationMode = "MANUAL";
            if (item.manualAllocations && item.manualAllocations.length > 0) {
              mappedItem.manualAllocations = item.manualAllocations;
            } else if (item._batchId) {
              mappedItem.manualAllocations = [
                {
                  batchId: item._batchId,
                  quantity:
                    (Number(item.quantitySold) || 0) +
                    (Number(item.freeQuantity) || 0),
                },
              ];
            } else {
              mappedItem.manualAllocations = [];
            }
          }
          return mappedItem;
        }),
        paymentType,
        notes,
      };

      invoiceData.isBatchTrackingEnabled = enableBatchTracking;

      if (enableBatchTracking) {
        invoiceData.allocationMode = allocationMode;
      }

      if (isEditMode && originalInvoice?.updatedAt) {
        invoiceData.lastKnownUpdatedAt = originalInvoice.updatedAt;
      }
      if (!isEditMode) {
        const requestId = createRequestId || generateCreateRequestId();
        invoiceData.createRequestId = requestId;
        if (!createRequestId) {
          setCreateRequestId(requestId);
        }
      }

      let result;
      if (isEditMode && editInvoiceId) {
        result = await invoiceService.updateInvoice(editInvoiceId, invoiceData);
        // Clear the draft after successful update
        clearDraftFromStorage();
        // Invalidate cache so all tabs get updated data
        invalidateCachePattern("invoices");
        invalidateCachePattern("dashboard");
        invalidateCachePattern("products"); // Stock changed
        invalidateCachePattern("customers"); // Customer summary changed
        // Also invalidate React Query customer caches so CustomerDetailsPage shows fresh data
        queryClient.invalidateQueries({ queryKey: ["customer-summary"] });
        queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
        success("Invoice updated successfully!");
      } else {
        result = await invoiceService.createInvoice(invoiceData);
        // Clear the draft after successful creation
        clearDraftFromStorage();
        // Invalidate cache so all tabs get updated data
        invalidateCachePattern("invoices");
        invalidateCachePattern("dashboard");
        invalidateCachePattern("products"); // Stock changed
        invalidateCachePattern("customers"); // Customer summary changed
        // Also invalidate React Query customer caches so CustomerDetailsPage shows fresh data
        queryClient.invalidateQueries({ queryKey: ["customer-summary"] });
        queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
        success("Invoice created successfully!");
      }

      const invoiceIdToNavigate = result?.invoice?._id || editInvoiceId;
      navigate(
        invoiceIdToNavigate ? `/invoices/${invoiceIdToNavigate}` : "/invoices",
      );
    } catch (err) {
      error(
        err.message ||
          err.message ||
          `Failed to ${isEditMode ? "update" : "create"} invoice`,
      );
    } finally {
      setSaving(false);
      submitInFlightRef.current = false;
    }
  };

  // Clear draft and reset form
  const handleClearDraft = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setInvoiceItems([]);
    setPaymentType("Credit");
    setNotes("");
    setCreateRequestId(generateCreateRequestId());
    setOriginalInvoice(null);
    originalStockAllocationsRef.current = new Map();
    clearDraftFromStorage();
    success("Draft cleared");

    // If we're on an edit URL, navigate to the create page so isEditMode
    // (derived from the URL) becomes false and the form behaves as "Create Invoice"
    if (isEditMode) {
      navigate("/invoices/create", { replace: true });
    }
  };

  if (loading) {
    return <InvoiceCreatePageSkeleton />;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial={isFirstVisit ? "hidden" : false}
      animate="visible"
      className="space-y-12"
    >
      {/* Customer Selection */}
      <motion.div
        variants={cardVariants}
        className="glass-card p-6 relative z-20"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <User className="w-5 h-5 text-blue-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-white">
              Customer Details
            </h2>
          </div>

          {/* Clear Draft Button - only show when there's data */}
          {(selectedCustomer || invoiceItems.length > 0) && (
            <motion.button
              onClick={handleClearDraft}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4" />
              Clear Draft
            </motion.button>
          )}
        </div>

        <div
          className={`relative ${showCustomerDropdown && customerSearch ? "pb-64" : ""}`}
        >
          <motion.div className="relative" whileFocus={{ scale: 1.01 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (
                  selectedCustomer &&
                  e.target.value !== selectedCustomer.customerName
                ) {
                  setSelectedCustomer(null);
                }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Search customer by name, phone, or GSTIN..."
              className="input pl-10"
            />
          </motion.div>

          <AnimatePresence>
            {showCustomerDropdown && customerSearch && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {isCustomerSearchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching customers...
                  </div>
                )}

                {!isCustomerSearchLoading &&
                  customerSearch.trim().length < 1 && (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      Start typing to search customers
                    </div>
                  )}

                {!isCustomerSearchLoading &&
                  customerSearch.trim().length >= 1 &&
                  customerResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      No customers found
                    </div>
                  )}

                {!isCustomerSearchLoading &&
                  customerSearch.trim().length >= 1 &&
                  customerResults.map((customer, index) => (
                    <motion.button
                      key={customer._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCustomerSelect(customer);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{
                        x: 4,
                        backgroundColor: "rgba(51, 65, 85, 0.9)",
                      }}
                    >
                      <p className="font-medium text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        {customer.customerName}
                      </p>
                      <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                        {customer.address ? (
                          <>
                            <MapPin className="w-3 h-3" />
                            {customer.address}
                          </>
                        ) : (
                          <>
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </>
                        )}
                        {customer.gstin && (
                          <>
                            <span className="text-slate-600">•</span>{" "}
                            {customer.gstin}
                          </>
                        )}
                      </p>
                    </motion.button>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {selectedCustomer && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />

              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="text-white font-bold text-lg">
                      {selectedCustomer.customerName.charAt(0)}
                    </span>
                  </motion.div>
                  <div>
                    <p className="font-medium text-white">
                      {selectedCustomer.customerName}
                    </p>
                    <p className="text-sm text-slate-300 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {selectedCustomer.phone}
                    </p>
                    {selectedCustomer.address && (
                      <p className="text-sm text-slate-300 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{selectedCustomer.address}</span>
                      </p>
                    )}
                  </div>
                </div>
                <motion.button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch("");
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4 text-slate-400" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Product Selection */}
      <motion.div
        variants={cardVariants}
        className="glass-card p-6 relative z-40"
      >
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            className="p-2 bg-accent-500/20 rounded-lg"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <ShoppingCart className="w-5 h-5 text-accent-400" />
          </motion.div>
          <h2 className="text-lg font-semibold text-white">Add Products</h2>
          {invoiceItems.length > 0 && (
            <>
              <motion.span
                className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {invoiceItems.length}{" "}
                {invoiceItems.length === 1 ? "item" : "items"}
              </motion.span>
              <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
                {sseConnectionState === "connected" ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-emerald-400">Live</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">
                      Stock updates unavailable
                    </span>
                  </>
                )}
              </span>
            </>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            placeholder="Search product by name or HSN..."
            className="input pl-10"
          />

          <AnimatePresence>
            {showProductDropdown && productSearch && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
              >
                {isProductSearchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching products...
                  </div>
                )}

                {!isProductSearchLoading && productSearch.trim().length < 1 && (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    Start typing to search products
                  </div>
                )}

                {!isProductSearchLoading &&
                  productSearch.trim().length >= 1 &&
                  productResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      No products found
                    </div>
                  )}

                {!isProductSearchLoading &&
                  productSearch.trim().length >= 1 &&
                  productResults.map((product, index) => {
                    const baseStock =
                      product.effectiveStockQty ?? product.currentStockQty ?? 0;
                    const availableStock = isEditMode
                      ? getCurrentEditStock(baseStock, product._id)
                      : baseStock;

                    return (
                      <motion.button
                        key={product._id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleProductSelect(product);
                        }}
                        onMouseEnter={() => {
                          if (enableBatchTracking && allocationMode === "AUTO") {
                            productService.getBatches(product._id);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductSelect(product);
                        }}
                        disabled={availableStock <= 0}
                        className={`w-full px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                          availableStock <= 0
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-slate-700"
                        }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={availableStock > 0 ? { x: 4 } : {}}
                      >
                        <div className="flex justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-white flex items-center gap-2">
                              <Package className="w-4 h-4 text-accent-400" />
                              {product.productName}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              GST: {product.gstPercentage}%
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-emerald-400">
                              {formatCurrency(product.rate)}
                            </p>
                            <p
                              className={`text-sm mt-1 flex items-center gap-1 ${
                                availableStock <= 10
                                  ? "text-red-400"
                                  : "text-slate-400"
                              }`}
                            >
                              <Package className="w-3 h-3" />
                              {availableStock}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Invoice Items Table */}
        <AnimatePresence mode="popLayout">
          {invoiceItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              {isDesktop ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <motion.tr
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <th>Product</th>
                        <th className="w-20">Qty</th>
                        <th className="w-20">Free</th>
                        <th className="w-24">Base</th>
                        <th className="w-24">Net Rate</th>
                        <th className="w-20">Disc %</th>
                        <th className="w-20">GST</th>
                        <th className="w-28">Total</th>
                        <th className="w-12"></th>
                      </motion.tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {invoiceItems.map((item, index) => {
                          const availableStock = getRemainingStockForItem(item);
                          const maxSoldQuantity = getMaxSoldQuantityForItem(
                            item,
                            index,
                          );

                          return (
                            <motion.tr
                              key={item._rowId || item._batchKey || `product_${item.product?._id}_${index}`}
                              custom={index}
                              variants={tableRowVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              layout
                              whileHover={{
                                backgroundColor: "rgba(51, 65, 85, 0.5)",
                              }}
                            >
                              <td>
                                <div>
                                  <p className="font-medium text-white flex items-center gap-1.5 flex-wrap">
                                    {item.product.productName}
                                    {item._batchPreview && (
                                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                        FIFO
                                      </span>
                                    )}
                                    {enableBatchTracking && (
                                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                                        Batch: {item.product.batchNo || item.batchNo || "No Batch #"}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Available: {availableStock}
                                    {item.product.newMRP != null && (
                                      <span className="text-slate-500">
                                        {" "}
                                        • MRP:{" "}
                                        {formatCurrency(item.product.newMRP)}
                                      </span>
                                    )}
                                  </p>
                                  {enableBatchTracking &&
                                    allocationMode === "MANUAL" && (
                                      <button
                                        onClick={() =>
                                          openBatchModal(index, item)
                                        }
                                        className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
                                      >
                                        {item.manualAllocations
                                          ? "Edit Batch Allocation"
                                          : "Select Batches"}
                                        {item.manualAllocations &&
                                          ` (${item.manualAllocations.reduce((s, a) => s + a.quantity, 0)}/${(Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0)})`}
                                      </button>
                                    )}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.quantitySold}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "quantitySold",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => {
                                    if (item.quantitySold === "" || Number(item.quantitySold) < 1) {
                                      updateItemQuantity(index, "quantitySold", 1);
                                    }
                                  }}
                                  className="input py-1.5 text-center"
                                  min="1"
                                  max={maxSoldQuantity}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.freeQuantity}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "freeQuantity",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => {
                                    if (item.freeQuantity === "" || Number(item.freeQuantity) < 0) {
                                      updateItemQuantity(index, "freeQuantity", 0);
                                    }
                                  }}
                                  className="input py-1.5 text-center"
                                  min="0"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.baseRate}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "baseRate",
                                      e.target.value,
                                    )
                                  }
                                  className="input py-1.5 text-center"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td className="text-center text-blue-400 font-medium">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    item.netRate !== undefined
                                      ? item.netRate
                                      : round(
                                          item.baseRate *
                                            (1 +
                                              item.product.gstPercentage / 100),
                                          2,
                                        )
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Allow empty, numbers, and decimals
                                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                      updateItemQuantity(index, "netRate", val);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // On blur, ensure we have a valid number
                                    const val = parseFloat(e.target.value) || 0;
                                    updateItemQuantity(
                                      index,
                                      "netRate",
                                      val.toString(),
                                    );
                                  }}
                                  className="input py-1.5 text-center text-blue-400"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.schemeDiscount}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "schemeDiscount",
                                      e.target.value,
                                    )
                                  }
                                  className="input py-1.5 text-center"
                                  min="0"
                                  max="100"
                                />
                              </td>
                              <td className="text-slate-300">
                                {item.product.gstPercentage}%
                                <span className="block text-xs text-slate-500">
                                  ₹{item.gstAmount.toFixed(2)}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.baseAmount}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "baseAmount",
                                      e.target.value,
                                    )
                                  }
                                  className="input py-1.5 text-center text-emerald-400 font-medium"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td>
                                <motion.button
                                  onClick={() => removeItem(index)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                  whileHover={{ scale: 1.2, rotate: 90 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {invoiceItems.map((item, index) => (
                      <InvoiceItemMobileCard
                        key={item._rowId || item._batchKey || `product_${item.product?._id}_${index}`}
                        item={item}
                        index={index}
                        updateItemQuantity={updateItemQuantity}
                        removeItem={removeItem}
                        availableStock={getRemainingStockForItem(item)}
                        maxSoldQuantity={getMaxSoldQuantityForItem(item, index)}
                        enableBatchTracking={enableBatchTracking}
                        allocationMode={allocationMode}
                        openBatchModal={openBatchModal}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {invoiceItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Package className="w-8 h-8 text-slate-400" />
            </motion.div>
            <p className="text-slate-400">Search and add products above</p>
          </motion.div>
        )}
      </motion.div>

      {/* Summary Section */}
      {invoiceItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Additional Details */}
          <div className="glass-card p-6 lg:col-span-2 relative z-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Additional Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enableBatchTracking && (
                <div className="md:col-span-2 mb-2">
                  <label className="label flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Batch Allocation Mode
                  </label>
                  <div className="flex gap-4">
                    <label 
                      className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all flex-1 ${
                        allocationMode === "AUTO"
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                          : "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="allocationMode"
                        value="AUTO"
                        checked={allocationMode === "AUTO"}
                        onChange={() => {
                          setAllocationMode("AUTO");
                          const uniqueProducts = new Map();
                          invoiceItems.forEach((item) => {
                            const pid = String(item.product._id);
                            const qty = (Number(item.quantitySold) || 0) + (Number(item.freeQuantity) || 0);
                            uniqueProducts.set(pid, {
                              product: item.product,
                              qty: (uniqueProducts.get(pid)?.qty || 0) + qty,
                              sourceItem: item,
                            });
                          });
                          uniqueProducts.forEach(({ product, qty, sourceItem }) => {
                            if (qty > 0) scheduleBatchPreview(product, qty, sourceItem);
                          });
                        }}
                        className="text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                      <div>
                        <span className={`block text-sm font-medium ${allocationMode === "AUTO" ? "text-blue-400" : "text-white"}`}>
                          Automatic (FIFO)
                        </span>
                        <span className="block text-xs text-slate-400 mt-0.5">
                          Deduct from oldest expiring batches
                        </span>
                      </div>
                    </label>
                    <label 
                      className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all flex-1 ${
                        allocationMode === "MANUAL"
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                          : "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="allocationMode"
                        value="MANUAL"
                        checked={allocationMode === "MANUAL"}
                        onChange={() => setAllocationMode("MANUAL")}
                        className="text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                      <div>
                        <span className={`block text-sm font-medium ${allocationMode === "MANUAL" ? "text-blue-400" : "text-white"}`}>
                          Manual Selection
                        </span>
                        <span className="block text-xs text-slate-400 mt-0.5">
                          Manually select batches for each product
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="label flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="select"
                >
                  <option value="Credit">Credit</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder="Any special notes..."
                />
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="glass-card p-6 relative z-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Calculator className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Invoice Summary
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white">
                  {formatCurrency(totals.baseAmount)}
                </span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount</span>
                  <span className="text-red-400">
                    -{formatCurrency(totals.totalDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Taxable Amount</span>
                <span className="text-white">
                  {formatCurrency(totals.totalTaxable)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CGST</span>
                <span className="text-white">
                  {formatCurrency(totals.totalCGST)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SGST</span>
                <span className="text-white">
                  {formatCurrency(totals.totalSGST)}
                </span>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-700">
                <span className="font-semibold text-white">Grand Total</span>
                <span className="text-xl font-bold text-emerald-400">
                  {formatCurrency(totals.netTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary w-full mt-6 py-3 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isEditMode ? "Updating Invoice..." : "Creating Invoice..."}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {isEditMode ? "Update Invoice" : "Create Invoice"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Batch Allocation Modal */}
      <Modal
        isOpen={batchModal.open}
        onClose={() => setBatchModal({ ...batchModal, open: false })}
        title="Select Batches"
        size="xl"
      >
        <div className="space-y-6">
          {/* Simple Header */}
          <div className="flex justify-between items-end mb-4 px-1">
            <div>
              <p className="text-slate-400 text-sm mb-0.5">Required Quantity</p>
              <p className="text-2xl font-semibold text-white">
                {batchModal.requiredQty}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm mb-0.5">Allocated</p>
              <p
                className={`text-2xl font-semibold ${
                  Object.values(batchModal.allocations).reduce(
                    (sum, q) => sum + (parseInt(q) || 0),
                    0,
                  ) === batchModal.requiredQty
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {Object.values(batchModal.allocations).reduce(
                  (sum, q) => sum + (parseInt(q) || 0),
                  0,
                )}{" "}
                / {batchModal.requiredQty}
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {batchModal.loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 bg-slate-800/50 rounded-lg border border-slate-700">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <p className="text-sm font-medium text-slate-300">
                  Loading available batches...
                </p>
              </div>
            ) : batchModal.batches.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-800/50 rounded-lg border border-slate-700">
                No available batches found for this product
              </div>
            ) : (
              batchModal.batches.map((batch) => (
                <div
                  key={batch._id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-slate-500"
                >
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Batch Number
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          {batch.batchNo && batch.batchNo !== "UNNAMED"
                            ? batch.batchNo
                            : "No Batch #"}
                        </p>
                        {new Date(batch.expiryDate) < new Date() && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            Expired
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Expiry Date</p>
                      <p
                        className={`font-medium ${new Date(batch.expiryDate) < new Date() ? "text-red-400" : "text-slate-300"}`}
                      >
                        {batch.expiryDate
                          ? new Date(batch.expiryDate).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Available</p>
                      <p className="font-medium text-slate-300">
                        {batch.remainingQty}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-xs text-slate-400 mb-1">
                        Rate / MRP / GST
                      </p>
                      <p className="font-medium text-slate-300">
                        {formatCurrency(batch.rate || 0)} /{" "}
                        {formatCurrency(batch.mrp || 0)} /{" "}
                        {batch.gstPercent || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-32 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max={batch.remainingQty}
                      value={batchModal.allocations[batch._id] || ""}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        setBatchModal((prev) => {
                          let val = rawVal;
                          const numVal = parseInt(val, 10);
                          
                          if (!isNaN(numVal) && numVal > 0) {
                            const otherTotal = Object.entries(prev.allocations)
                              .filter(([id]) => id !== String(batch._id))
                              .reduce((sum, [_, q]) => sum + (parseInt(q, 10) || 0), 0);
                              
                            const maxAllowedByReq = prev.requiredQty - otherTotal;
                            const maxAllowed = Math.min(
                              batch.remainingQty, 
                              Math.max(0, maxAllowedByReq)
                            );
                            
                            if (numVal > maxAllowed) {
                              val = maxAllowed.toString();
                            }
                          }
                          
                          return {
                            ...prev,
                            allocations: {
                              ...prev.allocations,
                              [batch._id]: val,
                            },
                          };
                        });
                      }}
                      className="input w-full text-center"
                      placeholder="Qty"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => setBatchModal({ ...batchModal, open: false })}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={saveBatchAllocations}
              disabled={batchModal.loading}
              className={`btn btn-primary ${batchModal.loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Save Allocations
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
