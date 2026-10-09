/**
 * Reusable Print Primitives for All Document Renderers
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS } from '../formats/documentPrintFormats';

/**
 * Renders the business firm / distributor header.
 */
export function PrintFirmHeader({ firm, format = PRINT_FORMATS.A4, documentTitle = '', subtitle = '' }) {
  const isThermal = format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58;
  const isThermal58 = format === PRINT_FORMATS.THERMAL_58;
  const firmName = firm?.firmName || firm?.name || 'Bharat Enterprise';

  if (isThermal) {
    return (
      <div className="text-center pb-2 mb-2 border-b border-black">
        <h1 className={`${isThermal58 ? 'text-xs' : 'text-sm'} font-bold uppercase tracking-tight leading-tight`}>
          {firmName}
        </h1>
        {firm?.firmAddress && (
          <p className="text-[9px] leading-tight mt-0.5">{firm.firmAddress}</p>
        )}
        <div className="flex flex-wrap justify-center gap-x-2 text-[9px] mt-0.5">
          {firm?.firmPhone && <span>Ph: {firm.firmPhone}</span>}
          {firm?.firmGSTIN && <span>GSTIN: {firm.firmGSTIN}</span>}
        </div>
        {firm?.firmDL && (
          <p className="text-[8px] mt-0.2">DL: {firm.firmDL}</p>
        )}
        {documentTitle && (
          <div className="mt-1 pt-1 border-t border-dashed border-black">
            <span className={`${isThermal58 ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider`}>
              {documentTitle}
            </span>
            {subtitle && <p className="text-[8px] text-gray-700">{subtitle}</p>}
          </div>
        )}
      </div>
    );
  }

  // Standard Sheet Layout (A4, A5)
  return (
    <div className="border-b-2 border-black pb-1.5 mb-2">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-base font-bold uppercase tracking-tight">
            {firmName}
          </h1>
          {firm?.firmAddress && (
            <p className="text-[10px] leading-tight text-gray-800">{firm.firmAddress}</p>
          )}
          <div className="flex flex-wrap gap-x-3 text-[10px] mt-0.5">
            {firm?.firmPhone && <span>Phone: {firm.firmPhone}</span>}
            {firm?.firmGSTIN && <span className="font-semibold">GSTIN: {firm.firmGSTIN}</span>}
            {firm?.firmDL && <span>DL No: {firm.firmDL}</span>}
          </div>
        </div>
        {documentTitle && (
          <div className="text-right shrink-0 pl-3">
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-gray-100 border border-black">
              {documentTitle}
            </span>
            {subtitle && <p className="text-[9px] text-gray-700 mt-0.5">{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders Party (Customer / Supplier) Details Block
 */
export function PrintPartyBlock({ party, title = 'Billed To', format = PRINT_FORMATS.A4, meta = null }) {
  const isThermal = format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58;
  const isThermal58 = format === PRINT_FORMATS.THERMAL_58;
  const partyName = party?.customerName || party?.name || 'Walk-in Customer';

  if (isThermal) {
    return (
      <div className="text-[9px] pb-1.5 mb-1.5 border-b border-black">
        <div className="flex justify-between font-bold">
          <span className="truncate">To: {partyName}</span>
          {party?.phone && <span>Ph: {party.phone}</span>}
        </div>
        {party?.address && (
          <p className="text-[8px] leading-tight text-gray-700 mt-0.5 break-words">{party.address}</p>
        )}
        {party?.gstin && (
          <p className="text-[8px] mt-0.5">GSTIN: {party.gstin}</p>
        )}
        {meta && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400 space-y-0.5 text-[8px]">
            {Object.entries(meta).map(([key, val]) => val ? (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className="font-semibold">{val}</span>
              </div>
            ) : null)}
          </div>
        )}
      </div>
    );
  }

  // Standard Sheet Layout (A4, A5)
  return (
    <div className="grid grid-cols-2 gap-4 pb-1.5 mb-1.5 border-b border-black text-[10px]">
      <div>
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{title}:</p>
        <p className="font-bold text-[11px] leading-tight mt-0.5">M/s {partyName}</p>
        {party?.address && <p className="leading-tight text-gray-800 mt-0.5 break-words">{party.address}</p>}
        <div className="flex gap-x-3 mt-0.5">
          {party?.phone && <span>Ph: {party.phone}</span>}
          {party?.gstin && <span className="font-semibold">GSTIN: {party.gstin}</span>}
          {party?.dlNo && <span>DL: {party.dlNo}</span>}
        </div>
      </div>
      {meta && (
        <div className="text-right space-y-0.5 text-[10px]">
          {Object.entries(meta).map(([key, val]) => val ? (
            <div key={key} className="flex justify-end gap-2">
              <span className="text-gray-600">{key}:</span>
              <span className="font-semibold">{val}</span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic Notes & Remarks Block — Never truncated, wraps naturally
 */
export function PrintNotesBlock({ notes, label = 'Notes / Remarks', format = PRINT_FORMATS.A4 }) {
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return null;
  }

  const isThermal = format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58;

  return (
    <div
      className={`${isThermal ? 'text-[8px] my-1 py-1' : 'text-[9px] my-1.5 py-1'} border-t border-dashed border-gray-400`}
      style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
    >
      <span className="font-bold text-gray-700">{label}: </span>
      <span className="whitespace-pre-wrap break-words">{notes.trim()}</span>
    </div>
  );
}

/**
 * Signatory Block with Page-Break Avoidance
 */
export function PrintSignatoryBlock({
  leftTitle = 'Customer Signature',
  rightTitle = 'Authorized Signatory',
  format = PRINT_FORMATS.A4,
  notes = null
}) {
  const isThermal = format === PRINT_FORMATS.THERMAL_80 || format === PRINT_FORMATS.THERMAL_58;
  const isThermal58 = format === PRINT_FORMATS.THERMAL_58;

  if (isThermal) {
    return (
      <div className="mt-2 pt-2 border-t border-black text-center text-[8px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <p className="italic mb-1">E &amp; O E · Thank you for your business!</p>
        <div className="h-6"></div>
        <p className="border-t border-black inline-block px-4 pt-0.5 font-semibold">
          {rightTitle}
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-3 pt-1 border-t border-black text-[10px]"
      style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
    >
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[9px] text-gray-600">E &amp; O E</p>
          {notes && <p className="text-[8px] text-gray-500 italic mt-0.5">{notes}</p>}
          {leftTitle && (
            <div className="mt-4 pt-1 border-t border-black w-36 text-center text-[9px]">
              {leftTitle}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="h-7"></div>
          <p className="border-t border-black pt-0.5 px-4 font-semibold text-[10px]">
            {rightTitle}
          </p>
        </div>
      </div>
    </div>
  );
}
