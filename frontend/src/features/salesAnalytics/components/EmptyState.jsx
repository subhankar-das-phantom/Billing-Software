import React from 'react';
import { motion } from 'framer-motion';
import { FileBarChart } from 'lucide-react';

export const EmptyState = ({ message = "No data available for the selected period." }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center h-full min-h-[200px]"
    >
      <motion.div
        className="p-4 bg-accent2-500/10 rounded-full mb-4"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <FileBarChart className="w-10 h-10 text-accent2-400 opacity-80" />
      </motion.div>
      <p className="text-slate-400 font-medium">{message}</p>
      <p className="text-sm text-slate-500 mt-1">Try selecting a different date range.</p>
    </motion.div>
  );
};
