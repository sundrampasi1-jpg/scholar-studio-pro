# JK Academy production feature completion

## Scope
Complete lesson reports, admin lesson comments, batch validity and renewal, and provider-backed live classes while preserving the existing design and working flows. Repair the current preview errors affecting reports and related pages.

## Implementation
1. **Reports:** Add the missing persistent AI response fields to the existing report records, repair the broken generation/write path, and provide student/admin retry and clear success/failure states. Keep saved reports visible even if AI generation fails.
2. **Admin comments:** Add a compact staff-only lesson-comment manager with lesson/student filtering, threaded teacher replies, manual reply, edit, and delete. Preserve student discussion and existing AI replies.
3. **Batch expiry and renewal:** Add per-batch validity with a 365-day default, enrollment purchase/expiry timestamps, and renewal history tied to payment records. Apply the same expiry gate to course/lesson access and student UI. Add batch selection where needed and show dates plus Renew/Re-pay in My Payments. Unlock or extend access only after verified gateway capture or admin-approved manual UPI payment; make updates idempotent.
4. **Live classroom:** Use the selected LiveKit provider. Add protected room/token creation and start/end controls, admin camera/microphone preview and batch targeting, student in-app joining, persistent real-time class chat, teacher replies, and join/leave attendance. Keep existing scheduled-link/recording support. Store LiveKit credentials only as server secrets.
5. **Verification:** Run relevant checks, repair build/runtime errors, and exercise reports/comments, expiry/renewal state transitions, and live room controls where credentials permit. Do not publish.

## Technical details
- Use additive migrations with explicit grants and RLS; enforce expiry in database access policies and privileged payment handlers, not only in the UI.
- Use existing Gemini and manual-UPI/Razorpay verification flows; request only the LiveKit server API key and secret after the provider-backed implementation is ready.
- LiveKit end-to-end video cannot be completed until those credentials are configured; report that dependency clearly if unavailable.
