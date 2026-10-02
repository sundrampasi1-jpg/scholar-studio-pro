# JK Academy — build roadmap

## Done
- Database schema (users/roles, courses, batches, subjects, chapters, lessons, enrollments, progress, tests, questions, attempts, live classes, notes, doubts, notifications, announcements, coupons, payments, branding settings) with RLS + grants
- Email sign-in enabled; signup/login/forgot/reset password screens
- Red design system, branding loaded from Admin settings
- Landing page, student shell, admin shell, student dashboard

## In progress / remaining
- Student pages: courses, course detail + enrol/checkout, lesson player + progress, tests + take test + results, live classes, notes/PDFs, doubts, notifications, announcements, profile, payments history
- Contact/Help page for students with official number 95695 51576
- Admin/Teacher panel: dashboard, course content manager (batches/subjects/chapters/lessons), tests + questions, live classes, notes, doubts, announcements/notifications, students, teachers, payments + coupons + enrolments, reports, branding settings
- Homepage social/search metadata (title, description, og tags)
- Verify all routes/buttons, role separation, build + runtime errors clean
- Admin: upload/record lesson videos (playable by students), upload PDFs, live class link + schedule
- Installable app (manifest, app name, icon, standalone mode) for Android packaging
- Google sign-in ("Continue with Google") alongside email/password + forgot password
- Only Sundrampasi1@gmail.com is admin (enforced in database); everyone else is student, read-only
- [ ] Google login opens account chooser, direct sign-in
- [ ] Admin Upload file / Record camera / Record screen work
- [ ] Admin uploads visible to students in course; student download works
- [x] Missing pages: profile, payments, help, announcements, admin payments
- [x] PDFs page-by-page with zoom + download (phone friendly)
- [ ] Real payments: waiting on owner's Razorpay keys (merchant/KYC)
- [ ] Google without extra screen: waiting on owner's own Google sign-in credentials
