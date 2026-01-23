import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  StickyNote,
  Edit2,
  Trash2,
  Pin,
  Calendar,
  X,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { noteService } from '../services/noteService';
import { formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import Modal from '../components/Common/Modal';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import EnhancedButton from '../components/Common/EnhancedButton';
import { useToast } from '../context/ToastContext';
import { useMotionConfig, useSWR, invalidateCachePattern } from '../hooks';
import RefreshIndicator from '../components/Common/RefreshIndicator';

const COLORS = [
  { id: 'blue', value: '#3B82F6', label: 'Blue' },
  { id: 'purple', value: '#8B5CF6', label: 'Purple' },
  { id: 'emerald', value: '#10B981', label: 'Emerald' },
  { id: 'amber', value: '#F59E0B', label: 'Amber' },
  { id: 'rose', value: '#F43F5E', label: 'Rose' },
  { id: 'cyan', value: '#06B6D4', label: 'Cyan' }
];

const initialNoteState = {
  title: '',
  content: '',
  color: '#3B82F6',
  isPinned: false
};

export default function NotesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState(initialNoteState);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, note: null });
  const { success, error } = useToast();
  
  const motionConfig = useMotionConfig();
  const searchDebounce = useDebounce(search, 300);

  // SWR: Instant cached data + background revalidation
  const { data, isLoading, isValidating, mutate } = useSWR(
    `notes-page-${page}-${searchDebounce}`,
    () => noteService.getNotes({ search: searchDebounce, page, limit: 12 }),
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  // Extract data from SWR response
  const notes = data?.notes || [];
  const totalPages = data?.pages || 1;
  const loading = isLoading && notes.length === 0;

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchDebounce]);

  const openCreateModal = () => {
    setEditingNote(null);
    setFormData(initialNoteState);
    setModalOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content || '',
      color: note.color || '#3B82F6',
      isPinned: note.isPinned
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      error('Title is required');
      return;
    }

    setSaving(true);
    try {
      if (editingNote) {
        await noteService.updateNote(editingNote._id, formData);
        success('Note updated successfully');
      } else {
        await noteService.createNote(formData);
        success('Note created successfully');
      }
      setModalOpen(false);
      // Invalidate cache for all tabs
      invalidateCachePattern('notes');
      mutate();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await noteService.deleteNote(deleteDialog.note._id);
      success('Note deleted successfully');
      setDeleteDialog({ open: false, note: null });
      // Invalidate cache for all tabs
      invalidateCachePattern('notes');
      mutate();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to delete note');
    }
  };

  const togglePin = async (e, note) => {
    e.stopPropagation();
    try {
      // Optimistic update in current data
      const updatedNotes = notes.map(n => 
        n._id === note._id ? { ...n, isPinned: !n.isPinned } : n
      ).sort((a, b) => {
        // Sort by pinned status then updated time
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      
      // Optimistically update local data
      mutate({ ...data, notes: updatedNotes }, false);
      
      await noteService.togglePin(note._id);
      // Invalidate cache for all tabs
      invalidateCachePattern('notes');
    } catch (err) {
      // Revert on error by revalidating
      mutate();
      error('Failed to update pin status');
    }
  };

  // Debounce hook implementation within file since it's simple
  function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  }

  // Adaptive variants based on device type
  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: motionConfig.shouldStagger ? 0.04 : 0
      }
    }
  }), [motionConfig.shouldStagger]);

  const cardVariants = useMemo(() => ({
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: motionConfig.isMobile
        ? { type: 'tween', duration: 0.2, ease: 'easeOut' }
        : { type: 'spring', stiffness: 300, damping: 24 }
    }
  }), [motionConfig.isMobile]);

  if (loading && !search) {
    return <PageLoader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="input pl-10 w-full"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <RefreshIndicator isRefreshing={isValidating} size="sm" />
          <EnhancedButton
            onClick={openCreateModal}
            icon={Plus}
            className="w-full md:w-auto"
          >
            Add Note
          </EnhancedButton>
        </div>
      </div>

      {/* Notes Grid */}
      <AnimatePresence mode="wait">
        {notes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-12 text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6">
              <StickyNote className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No notes found</h3>
            <p className="text-slate-400 mb-6">
              {search ? 'Try a different search term' : 'Create your first note to get started'}
            </p>
            {!search && (
              <EnhancedButton onClick={openCreateModal} icon={Plus}>
                Create Note
              </EnhancedButton>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="notes-grid"
            initial={false}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {notes.map((note, index) => (
                <motion.div
                  key={note._id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    transition: { 
                      delay: motionConfig.shouldStagger ? Math.min(index * 0.03, 0.12) : 0,
                      duration: 0.2 
                    }
                  }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  className="group relative flex flex-col glass-card h-48 sm:h-64 overflow-hidden border-t-4 transition-all hover:shadow-xl hover:-translate-y-1"
                  style={{ borderTopColor: note.color }}
                  onClick={() => openEditModal(note)}
                >
                {/* Note Header */}
                <div className="p-4 sm:p-5 pb-0 flex justify-between items-start gap-2">
                  <h3 className="font-semibold text-lg text-white line-clamp-2 leading-tight">
                    {note.title}
                  </h3>
                  <button
                    onClick={(e) => togglePin(e, note)}
                    className={`p-1.5 rounded-full transition-colors ${
                      note.isPinned 
                        ? 'bg-yellow-500/20 text-yellow-400' 
                        : 'text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Pin size={16} className={note.isPinned ? 'fill-current' : ''} />
                  </button>
                </div>

                {/* Note Content */}
                <div className="p-4 sm:p-5 flex-1 overflow-hidden">
                  <p className="text-slate-400 text-sm whitespace-pre-wrap line-clamp-4 sm:line-clamp-6">
                    {note.content}
                  </p>
                </div>

                {/* Note Footer */}
                <div className="p-4 pt-0 mt-auto flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(note.updatedAt)}
                  </span>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(note);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialog({ open: true, note });
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <AnimatePresence>
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center justify-center gap-4 mt-8"
          >
            <motion.button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`p-2 rounded-lg transition-colors ${
                page === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              whileHover={motionConfig.shouldHover && page !== 1 ? { scale: 1.1 } : undefined}
              whileTap={motionConfig.shouldHover && page !== 1 ? { scale: 0.9 } : undefined}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
            </div>

            <motion.button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`p-2 rounded-lg transition-colors ${
                page === totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              whileHover={motionConfig.shouldHover && page !== totalPages ? { scale: 1.1 } : undefined}
              whileTap={motionConfig.shouldHover && page !== totalPages ? { scale: 0.9 } : undefined}
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingNote ? 'Edit Note' : 'Add Note'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input text-lg font-medium"
              placeholder="Note title"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="input min-h-[200px] resize-y"
              placeholder="Write your note here..."
              maxLength={5000}
            />
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === color.value 
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' 
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                >
                  {formData.color === color.value && (
                    <CheckCircle className="w-5 h-5 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={formData.isPinned}
              onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
            <label htmlFor="isPinned" className="text-sm font-medium text-white select-none cursor-pointer">
              Pin this note to top
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <EnhancedButton
              type="submit"
              disabled={saving}
              icon={saving ? Loader2 : null}
            >
              {saving ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
            </EnhancedButton>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, note: null })}
        onConfirm={handleDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  );
}
