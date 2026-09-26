import { useState, useCallback, useRef } from 'react';
import { shareService } from '../services/sharing/shareService';
import { useToast } from '../contexts/ToastContext';

/**
 * Reusable hook for sharing resources (Invoices, Receipts, Quotations, etc.)
 * Provides:
 * 1. "Send a copy" — Shares the generated PDF file natively, or downloads it with clear feedback if unsupported.
 * 2. "Send link" — Obtains/reuses a cryptographically secure public URL, sharing natively or copying to clipboard.
 */
export function useShareResource({
  resourceType = 'invoice',
  resourceId,
  resourceTitle,
  fileName,
  getPdfBlob
}) {
  const [isSharingCopy, setIsSharingCopy] = useState(false);
  const [isSharingLink, setIsSharingLink] = useState(false);
  const { success, error, info } = useToast();
  const lockRef = useRef(false);

  const shareCopy = useCallback(async () => {
    if (lockRef.current || !getPdfBlob) return;
    lockRef.current = true;
    setIsSharingCopy(true);

    try {
      const blob = await getPdfBlob();
      const safeName = (fileName || `${resourceTitle || 'Invoice'}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const file = new File([blob], safeName, { type: 'application/pdf' });

      // Check if native file sharing is supported
      const canShareFile = typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            title: resourceTitle || 'Invoice',
            text: resourceTitle || 'Invoice PDF',
            files: [file]
          });
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return; // User closed sheet
          console.warn('[useShareResource] Native file share failed, falling back to download:', shareErr);
        }
      }

      // Fallback: Download file directly
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      info('Direct file sharing is not supported by your browser. Invoice PDF has been downloaded.');
    } catch (err) {
      console.error('[useShareResource] Failed to generate/share PDF copy:', err);
      error('Failed to generate invoice PDF copy');
    } finally {
      setIsSharingCopy(false);
      lockRef.current = false;
    }
  }, [getPdfBlob, fileName, resourceTitle, error, info]);

  const shareLink = useCallback(async () => {
    if (lockRef.current || !resourceId) return;
    lockRef.current = true;
    setIsSharingLink(true);

    try {
      const result = await shareService.getOrCreateShareLink({
        resourceType,
        resourceId
      });

      const shareUrl = `${window.location.origin}/share/${result.rawToken}`;
      const title = resourceTitle || 'Invoice';
      const text = `${title} — View online:`;

      // Try native URL sharing where available
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title,
            text,
            url: shareUrl
          });
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return; // User closed sheet
        }
      }

      // Fallback: Copy link to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      success('Secure invoice link copied to clipboard!');
    } catch (err) {
      console.error('[useShareResource] Failed to create or copy share link:', err);
      error('Failed to generate share link');
    } finally {
      setIsSharingLink(false);
      lockRef.current = false;
    }
  }, [resourceType, resourceId, resourceTitle, success, error]);

  return {
    shareCopy,
    shareLink,
    isSharingCopy,
    isSharingLink
  };
}

export default useShareResource;
