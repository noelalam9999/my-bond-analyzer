"use client";

import { fmtBDT, fmtDate, type BondRow } from "@/lib/bonds";
import { useEffect, useRef } from "react";

export function CouponCalendarDialog({ bond, onClose }: { bond: BondRow | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !bond) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [bond]);
  const calendar = bond?.couponCalendar;
  const payments = calendar?.payments ?? [];
  return (
    <dialog ref={dialog} aria-labelledby="coupon-calendar-title" aria-describedby="coupon-calendar-bond"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      } }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="coupon-calendar-title" className="text-lg font-semibold">Coupon calendar</h2>
            <p id="coupon-calendar-bond" className="mt-1 text-sm text-zinc-500">{bond?.title}<br /><span className="font-mono text-xs">{bond?.isin}</span></p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close coupon calendar" className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">Close</button>
        </div>
        {calendar?.source === "unavailable" ? (
          <p className="text-sm text-zinc-500">Coupon dates are unavailable because this bond has no valid payment schedule or maturity date.</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-zinc-500">No remaining coupon payments. This bond has reached maturity.</p>
        ) : (
          <>
            <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Next scheduled coupon · {fmtDate(new Date(payments[0].date + "T00:00:00Z"))}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">BDT {fmtBDT(payments[0].coupon)}</div>
              <div className="mt-1 text-xs text-zinc-500">{payments.length} payment{payments.length === 1 ? "" : "s"} remaining · BDT {fmtBDT(payments.reduce((total, p) => total + p.coupon, 0))} in coupons</div>
            </div>
            <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payments.map((payment, index) => (
                <li key={payment.date} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">{fmtDate(new Date(payment.date + "T00:00:00Z"))}</div>
                    <div className="mt-1 text-xs text-zinc-500">{index === 0 ? "Next coupon" : "Coupon"}{payment.principal > 0 ? " · Maturity" : ""}</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div>BDT {fmtBDT(payment.coupon)}</div>
                    {payment.principal > 0 && <div className="mt-1 text-xs text-zinc-500">+ BDT {fmtBDT(payment.principal)} principal</div>}
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-xs leading-relaxed text-zinc-500">
              {calendar?.source === "quote" ? "Schedule projected from Bangladesh Bank’s cached next coupon date and payment frequency." : "Estimated semi-annual schedule based on the maturity date; no Bangladesh Bank coupon schedule is available."}
              {" "}Gross amounts before tax, using the portfolio’s face-value assumption. Scheduled dates may differ from actual bank credit dates.
            </p>
          </>
        )}
    </dialog>
  );
}
