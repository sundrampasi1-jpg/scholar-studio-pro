# Elevate Academy Platform

Upgrade my existing JK Academy app. Do NOT rebuild it from scratch, do NOT delete existing features, and do NOT replace working functionality. Extend the existing app into a complete, production-ready coaching/LMS platform.



1. BRAND & UI



- App name: JK Academy

- Theme color: RED as the primary brand color.

- Use white/light neutral backgrounds with red accents.

- Premium, clean, professional Indian competitive-exam coaching design.

- Mobile-first responsive UI.

- No childish, gaming-style or excessive gradients.

- Keep the design consistent across Student, Teacher and Admin areas.



2. AUTHENTICATION



Create a complete real authentication system:



- Student Sign Up

- Student Login

- Admin Login

- Teacher Login

- Logout

- Persistent login/session

- Forgot password/reset password

- Proper validation and error messages

- Role-based access control

- Students must not access Admin/Teacher pages.

- Admin must be able to manage user accounts.



If phone OTP is supported by the existing backend, include mobile OTP authentication. Otherwise keep the authentication architecture ready for secure OTP integration without breaking normal login.



3. ADMIN PANEL



Create a secure and fully functional Admin Dashboard.



Admin should be able to customize and manage the entire app without editing code.



Admin modules:



- Dashboard

- Students

- Teachers

- Courses

- Batches

- Subjects

- Chapters

- Lessons

- Videos

- Notes/PDFs

- Live Classes

- Tests

- Questions

- Results

- Doubts

- Notifications

- Announcements

- Payments

- Orders/Transactions

- Coupons/Discounts

- Enrollments

- Reports/Analytics

- App Settings



Every module must support appropriate Add / Edit / Delete / Search / Filter actions.



4. WHITE-LABEL / SELLABLE APP CUSTOMIZATION



The app should be designed so I can sell/license it to another coaching institute.



Admin should have an App Customization / Branding section where the owner can change without code:



- App name

- Logo

- Favicon/app icon where supported

- Primary theme color

- Secondary color

- Coaching/institute name

- Tagline

- Contact information

- Support information

- Social links

- About section

- Home page branding/content

- Notification/announcement branding



Changes should automatically reflect throughout the student-facing app wherever applicable.



Do not hard-code JK Academy branding into every component. Keep branding configurable from Admin Settings, with JK Academy as the default.



5. STUDENT DASHBOARD



Create a complete student dashboard containing:



- Profile

- My Courses

- Continue Learning

- Course Progress

- Upcoming Live Classes

- Recent Lessons

- Tests

- Results

- Notes/PDFs

- Doubts

- Notifications

- Announcements

- Payment/enrollment history



6. COURSE MANAGEMENT



Use this structure:



Course → Batch → Subject → Chapter → Lesson



Admin/authorized teachers should be able to create and manage this structure.



Lessons should support:



- Video

- Description

- Notes/PDF

- Previous/Next lesson

- Mark as completed

- Persistent progress

- Lesson completion tracking



7. COURSE PROGRESS



Track progress using real persistent data.



For every enrolled course show:



- Completed lessons

- Total lessons

- Percentage progress

- Subject/chapter progress

- Last visited lesson

- Continue Learning



Admin should be able to view individual student progress.



8. TEST SYSTEM



Create a functional test system:



- MCQ questions

- Multiple options

- Timer

- Question navigation

- Mark for review

- Skip

- Submit

- Automatic scoring

- Results

- Correct answers/solutions

- Attempt history

- Admin test/question management



9. LIVE CLASSES



Admin/Teacher can create:



- Live class title

- Course/batch

- Teacher

- Date

- Time

- Join URL

- Description

- Recording URL



Student sees:



- LIVE NOW

- Upcoming classes

- Completed classes

- Join button

- Recording when available

- Notifications/reminders



10. NOTES & PDF



Admin/Teacher can upload and organize notes/PDFs by:

Course → Subject → Chapter → Lesson.



Students can view PDFs with proper mobile-friendly controls and download where permitted.



11. DOUBTS



Students can:



- Submit a doubt

- Add text

- Attach an image where supported

- View doubt history

- See teacher/admin replies



Teachers/Admin can:



- View doubts

- Reply

- Mark resolved/pending



12. PAYMENT & ENROLLMENT



Add a real payment-ready architecture.



Admin should be able to:



- Create paid/free courses

- Set course price

- Create coupons/discounts

- View payments

- View transactions

- View successful/failed/pending payment status

- Manage student enrollments



Students should be able to:



- View course price

- Start checkout

- Complete payment through a properly integrated payment gateway when credentials are configured

- Automatically receive enrollment/access after successful payment

- View payment/enrollment history



Do NOT fake successful payments. If payment gateway credentials are not configured, show a proper configuration state instead of pretending that a payment succeeded.



Keep the payment system modular so a payment provider can be connected later without rebuilding the app.



13. NOTIFICATIONS



Create real notification management:



- Admin announcements

- New course

- New lesson

- Live class

- Test

- Result

- Payment/enrollment

- General announcements



Students should have a notification center with read/unread status.



14. DATABASE & SECURITY



Use the existing backend/database where possible.



Create proper persistent relationships between:

Users, Roles, Courses, Batches, Subjects, Chapters, Lessons, Enrollments, Progress, Tests, Questions, Results, Live Classes, PDFs, Doubts, Notifications, Payments and Transactions.



Implement:



- Authentication

- Authorization

- Role-based access

- Secure admin routes

- Input validation

- Proper error handling

- Loading states

- Empty states

- Success states

- Offline/network error states where appropriate



Never expose secret API keys or payment credentials in frontend code.



15. ADMIN CUSTOMIZATION IS IMPORTANT



The final product must behave like a reusable coaching-app product, not a one-time JK Academy website.



An institute owner who purchases the app should be able to log into Admin and customize its branding, content, courses, users, teachers, payments and learning material without changing source code.



16. FINAL REQUIREMENT



Do not create fake/demo buttons.



Every important button and workflow must actually function.



Do not remove existing JK Academy features.



Do not create only static screens.



Make the Student App + Teacher Area + Admin Panel + Authentication + Course Management + Progress + Tests + Live Classes + Doubts + Notifications + Payment/Enrollment system work as one connected application.



Before finishing:



1. Run the application.

2. Check all routes/navigation.

3. Fix build/runtime errors.

4. Check mobile responsiveness.

5. Verify Student/Admin/Teacher role separation.

6. Verify course → lesson → progress flow.

7. Verify test → result flow.

8. Verify enrollment/payment states.

9. Verify Admin customization affects the student-facing branding.

10. Leave the project in a clean, working state ready for further testing and deployment.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://scholar-studio-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/44243744-a432-4bce-9308-efc8a2219a1f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
