Kathua Fresh Smart Digital Signage System - PRD v1.0
Draft for owner review - 30 October 2026 - Planning only: no code, database, Supabase, Vercel or website change has been made or is proposed until you approve this document.
0. How to read this document
Evidence labels used throughout
Label
Meaning
VERIFIED
Told to me by you (TV model, Android version, WebView version, resolution, stack).
ASSUMED
A reasonable engineering assumption I am making; it can be wrong.
PENDING
Must be checked on your real TV / account before it is relied on.
Important limits of this draft (please read)
• I do not have access to your website source code, Supabase dashboard or Vercel account in this chat. So the 'what to reuse' analysis in Section 12.2 is a decision framework plus a read-only audit checklist, not a finding about your actual project. Nothing about your current tables, plans or auth is VERIFIED.
• I have not looked up live Supabase / Vercel pricing. Section 24 gives cost structure and the exact items to check, with no invented rupee or dollar figures.
• TV RAM, free storage, physical screen size, Google speech engine and Hindi voice availability are all PENDING. Section 13 is the checklist to close them.
Known hardware (VERIFIED): Xiaomi MiTV-AXSO0, Android TV 9 (API 28), 1920x1080, Android System WebView 138.0.7204.179. RAM: PENDING.
1. Executive Summary
Kathua Fresh will turn the shop Smart TV into an always-on, branded promotion screen that you control from your phone. You upload an offer image (for example 'Onion Rs 40/kg'), preview it, press Publish, and the TV shows it within seconds, with no refresh. Kathua Fresh logo, website and QR codes stay on screen permanently. The TV can also speak short Hindi/English announcements at a polite interval, and keeps playing the last good playlist if the internet drops.
Recommended solution (one line): a Next.js mobile PWA admin + a very small Kotlin Android TV app that does nothing except host one WebView pointing to a dedicated /tv display page, cache images on disk, speak through Android TTS and recover from errors.
Why this is the simplest reliable option: your site is already Next.js on Vercel with Supabase, the TV's WebView (138) is modern enough for a normal web page, and putting rendering in the web layer means 90% of future changes need no APK reinstall.
Biggest risks (all manageable): low-RAM TV, audio autoplay rules, Xiaomi TV boot auto-start behaviour, TV clock accuracy when offline, and accidentally coupling this to the live e-commerce site. Each has a mitigation in Section 29.
2. Product Vision
A shop owner with no technical skill can change what the whole shop sees and hears in under 60 seconds from the phone in his hand, and the screen never goes blank, never looks unbranded, and never shows an expired or unapproved offer.
Design principles: (1) lightweight over clever, (2) the TV is a dumb, durable player, (3) nothing goes live without owner approval, (4) works through internet loss, (5) separate from the e-commerce site's data, (6) ready for TV #2 without building it now.
3. Business Objectives
#
Objective
Measure of success
B1
Show current offers to walk-in customers
New offer visible on TV <= 30 s after Publish (target <= 5 s when Realtime is connected)
B2
Drive WhatsApp channel / Instagram / website traffic
Permanent QR codes on every slide; scannable at normal shop distance (tested)
B3
Reduce owner effort
Publish a new offer in <= 3 taps after choosing the image
B4
Reliability
Player runs 24 h continuously, no blank screen, auto-recovers from crash/restart
B5
Low cost
No mandatory new paid service in MVP (subject to checking existing plan limits)
B6
No harm to e-commerce site
Zero changes to existing tables/routes; isolated signage_ data and /tv, /admin/signage routes
Not an objective: proving customer views or QR scans. The system can only report that a slide was played on the TV.
4. User Personas
P1 - Owner / Admin (primary). Runs Kathua Fresh, uses a smartphone all day, Hindi/English, not technical, wants one-two-tap actions, fears accidental wrong prices on screen.
P2 - Staff member (future, optional). Can upload drafts but cannot publish or delete. MVP: single admin only; role column prepared in schema.
P3 - Customer (indirect). Stands or walks in the shop, glances at the TV, may scan a QR from 1-3 m. Needs large text, high contrast, calm audio.
P4 - Technician / Developer (one-time). Installs the APK, verifies hardware, maintains the system.
5. User Stories
ID
As a...
I want to...
So that...
Priority
US-01
Owner
upload an image from gallery or camera
I can create an offer in seconds
MVP
US-02
Owner
add title, price text, duration, start/end date
the slide plays only when I want
MVP
US-03
Owner
preview exactly how it looks on the TV layout
I catch mistakes before customers see them
MVP
US-04
Owner
press Publish and see the TV update by itself
I never touch the TV
MVP
US-05
Owner
pause, resume, edit, reorder, delete a slide
I keep offers current
MVP
US-06
Owner
be asked to confirm before deleting
I do not lose things by accident
MVP
US-07
Owner
change the WhatsApp/Instagram QR codes
links can change without a developer
MVP
US-08
Owner
type a Hindi announcement and set how often it plays
the TV speaks without annoying customers
MVP
US-09
Owner
upload my own recorded MP3
I can use my own voice or a Dogri recording
MVP
US-10
Owner
pair the TV using a short code
only my TV obeys my dashboard
MVP
US-11
Owner
see whether the TV is online and when it last synced
I know the screen is working
MVP
US-12
Owner
have offers expire automatically
old prices never stay on screen
MVP
US-13
Customer
see large prices and a scannable QR
I can read and follow the shop
MVP
US-14
Owner
run a different playlist on TV 2
future expansion
Future
US-15
Owner
upload video ads and background music
richer marketing
Future
6. Complete Feature List
Area
MVP
Future
Admin (mobile PWA)
Home, Upload, Manage, Playlist, QR, Voice, Devices, Preview, Schedule, Settings, Publish/Pause/Resume
Staff roles, templates, festival campaign kits
Media
JPG/PNG/WebP, camera upload, client-side resize to 1080p, 16:9 check, thumbnails
Video (MP4), image templates, AI-assisted price banners
Promotions
CRUD, draft/published, schedule, expiry, per-slide duration, enable/disable, reorder
Per-slide transitions, tags, campaign grouping
Playlist
One active playlist, loop, pause/resume, next/prev from phone
Multiple playlists, per-TV playlists, day-parting
Branding
Permanent logo, website, 2 QR + extra custom QR, scan captions, ticker, configurable layout
Multiple layout themes
Sync
Version-ping (Realtime) + polling fallback, ETag manifest, delta download
Multi-TV broadcast
Offline
Disk image cache, cached manifest, last-valid playlist, local expiry check
Pre-download scheduling
Voice
Android TTS (Hindi/English), MP3 playback, frequency, volume, on/off, no-overlap queue, per-promo link, welcome/offer/marketing types
Advanced scheduling, cloud TTS, background music
Devices
6-char pairing, expiry, heartbeat, rename, disconnect, remove
Multi-TV groups
Safety
Draft -> Preview -> Approve -> Publish, delete confirmation, audit log
Approval by second person
Monitoring
Online/offline, last heartbeat/sync, active/expired counts, storage use, errors, recent publishes
Play-count analytics (not customer views)
7. Functional Requirements
7.1 Promotions & media
• FR-PM-01 Accept JPG, PNG, WebP up to a configurable limit (proposed 10 MB original). Reject other types by checking file signature (magic bytes), not just extension.
• FR-PM-02 Phone resizes/compresses before upload (target 1920x1080 max, WebP or high-quality JPEG ~ 300-700 KB) so mobile data and TV memory stay low.
• FR-PM-03 Warn (do not block) if aspect ratio is not 16:9; offer 'fit with blurred background' or 'crop'.
• FR-PM-04 Create/edit/delete promotion with: title, optional price text, image, duration (default 10 s, range 3-60 s), start, end, status, enabled flag.
• FR-PM-05 Statuses: draft, scheduled, live, paused, expired, archived. Only the owner moves a draft to published.
• FR-PM-06 Media is separate from promotions. Deleting a promotion removes only that promotion; the file is deleted from storage only when no promotion/playlist/announcement references it (reference count check) and the owner confirms.
• FR-PM-07 Deleting from the live playlist removes it from the TV on the next sync; the TV also deletes the cached file once no longer referenced.
• FR-PM-08 Reorder by drag-and-drop with Up/Down button fallback (easier on phones).
7.2 Playlist & slideshow
• FR-PL-01 One active playlist in MVP; table design supports many.
• FR-PL-02 Items have position, duration override, enabled flag.
• FR-PL-03 The player plays items in order, loops forever, skips items not currently valid (start > now or end < now or disabled).
• FR-PL-04 Pause/Resume/Next/Previous from the phone (sent as a lightweight command).
• FR-PL-05 Transition: one cheap default (cross-fade ~600 ms); optional 'none'. The next image is pre-decoded so there is never a black frame.
• FR-PL-06 If no valid promotion exists, show a branded 'welcome' slide (never blank).
7.3 Branding & QR
• FR-BR-01 Logo, website text, tagline, ticker text, colours and layout profile come from configuration, not code.
• FR-BR-02 QR codes are generated from a stored URL/text (admin enters URL; QR image is generated server-side or in browser as SVG and cached). Each QR has label, caption, enabled flag, position order. WhatsApp and Instagram are defaults; extra QR slots allowed (recommend max 3 visible on TV).
• FR-BR-03 QR drawn as crisp SVG/canvas at integer pixel size with >= 4-module quiet zone, black on white, never stretched.
• FR-BR-04 Branding area is outside the promotion rectangle so it is never covered by a slide.
7.4 Voice (summary; details in Section 19)
• FR-VO-01 Announcement types: welcome, offer, marketing. Source: TTS text or MP3.
• FR-VO-02 Global master switch, volume, minimum gap between announcements, quiet hours.
• FR-VO-03 Single-flight queue: a new announcement never interrupts a playing one.
• FR-VO-04 Optional link to a promotion: announcement plays when that slide is on screen, subject to the global gap.
7.5 Devices, publish, monitoring
• FR-DV-01..05 Pairing, expiry, authorized-only access, rename, disconnect, remove (Section 20).
• FR-PB-01 Publish creates a new immutable publish version (a snapshot of playlist + branding + announcements). TV only ever plays a complete version.
• FR-PB-02 'Revert to previous version' available (cheap because versions are snapshots).
• FR-MN-01 Heartbeat every 60 s: app version, current slide, cache size, free storage, memory class, last error.
• FR-AU-01 Audit log of publish, delete, QR change, pair/remove device, login.
8. Non-Functional Requirements
Category
Requirement
Target (to be confirmed on the real TV)
Performance
Cold start to first slide
<= 15 s after launch; cached content shows without waiting for network
Performance
Slide change
No visible black frame; steady ~30+ fps transitions
Memory
Player WebView + app
Stay within a budget set after RAM is verified (PENDING); no growth over 24 h
Reliability
Continuous run
24 h pass (Test 13); automatic recovery from WebView crash within 30 s
Sync
Publish -> TV
<= 5 s (Realtime connected), <= 30 s (polling)
Offline
Internet loss
Unlimited playback of last version; reconnect automatically
Security
Device and admin separation
Device token can only read its own manifest
Usability
Admin
Core actions <= 2 taps from Home; Hindi/English labels option
Compatibility
Android
minSdk 28 (Android 9); no APIs above 28 without checks
Size
APK
Small (target well under 10 MB, no heavy libraries)
Cost
Infra
Stay within existing free/current plan limits if possible
Maintainability
Updates
Display changes ship via web deploy, not APK
9. Mobile Dashboard Wireframes
Mobile-first, one thumb, big buttons. Bottom bar with 5 tabs: Home | Offers | Playlist | Voice | More (More = QR Codes, TV Devices, Schedule, Settings). A floating green + New Offer button is on Home and Offers.
9.1 Home (Dashboard)
+--------------------------------+
| Kathua Fresh TV        [gear]  |
| TV: ONLINE (Shop TV 1)         |
| Last sync 12:41  |  v14 live   |
+--------------------------------+
| [ + New Offer ]   (big, green) |
| [ Pause TV ] [ Next slide ]    |
+--------------------------------+
| Live now: 6 offers | 1 draft   |
| Expiring today: 1  | Errors: 0 |
+--------------------------------+
| Mini live preview (16:9)       |
+--------------------------------+
| Recent: Onion 40/kg published  |
+--------------------------------+
| Home Offers Playlist Voice More|
+--------------------------------+
9.2 Upload / New Offer (3 steps, one screen each)
1. Choose: [Camera] [Gallery]. Image appears; app checks size and ratio.
2. Details: Title, Price text (optional), Show for (chips: 8 / 10 / 15 / 20 s, default 10), Start (Now / pick), End (Never / pick date), Voice line (optional, links to an announcement).
3. Preview + Save: exact TV layout preview with branding and QR; buttons [Save as Draft] and [Publish Now]. Publish shows a confirm sheet: 'Publish 7 offers to Shop TV 1?'
9.3 Manage Promotions - list of cards with thumbnail, title, status chip (Draft / Live / Scheduled / Paused / Expired), toggle, and a menu: Edit, Duplicate, Pause/Resume, Move up/down, Delete. Filter chips: All, Live, Draft, Scheduled, Expired.
9.4 Playlist - ordered list with drag handles (plus up/down arrows), per-item duration, enable toggle, 'Total loop time: 1 min 12 s', and a [Publish changes] button that appears only when there are unpublished edits.
9.5 Voice - master switch, volume slider with [Test on TV], frequency selector (every 2 / 3 / 5 / 10 min / off), quiet hours, announcement list (Welcome / Offer / Marketing), editor with language (Hindi / English), text box, or [Upload MP3], and [Play on TV now].
9.6 QR Codes - cards for WhatsApp Channel, Instagram, Extra; each with URL field, caption, on/off, live QR preview, and a hint 'Test: scan this with another phone'.
9.7 TV Devices - device card (name, status dot, last active, app version, cache size), [Pair new TV] (enter 6-character code), Rename, Disconnect, Remove (confirm by typing the device name).
9.8 Live TV Preview - an in-app view of the /tv renderer in 'preview mode' using the draft content, clearly labelled 'PREVIEW - not live'. A second toggle shows 'Currently on TV' (last slide reported by the heartbeat; real screenshots are not captured in MVP).
9.9 Scheduling - list/calendar of promotions by start and end; quick presets: 'Today only', 'This weekend', 'Until I stop it'.
9.10 Settings - brand colours, logo, website text, ticker text, layout profile (Standard / Immersive), default slide duration, transition, image size limit, sign-out, 'Re-sync TV cache'.
10. TV Display Wireframes (1920 x 1080, landscape)
10.1 Layout A - 'Standard' (default for MVP). The promotion rectangle is an exact 16:9 so 16:9 images are never cropped or stretched.
 0                                          1500        1920
 +------------------------------------------+------------+ 0
 |                                          | LOGO       |
 |                                          | Kathua     |
 |        A. MAIN PROMOTION AREA            | Fresh      |
 |           1500 x 844 (16:9)              +------------+ 150
 |        image / future video              | [QR WhatsApp]
 |                                          |  260x260   |
 |                                          | Join our   |
 |                                          | WhatsApp   |
 |                                          | Channel    |
 |                                          +------------+ 500
 |                                          | [QR Insta] |
 |                                          |  260x260   |
 |                                          | Follow for |
 |                                          | daily offers
 +------------------------------------------+------------+ 844
 | D. TICKER: Fresh vegetables daily | Visit  www.kathuafresh.in | 236 px
 | big website text, tagline, optional 3rd QR              |
 +--------------------------------------------------------+ 1080
Zone
Size (px)
Content
A Promotion
1500 x 844
Image (cross-fade), thin progress line at the bottom edge
B Brand panel (top-right)
420 x 150
Logo from config
C QR panel
420 x 694
2 QR cards (260 px QR + caption each, white quiet zone, brand-colour frame); an optional third QR replaces the website block
D Bottom bar
1920 x 236
Website in very large type (64 px or more), tagline, scrolling ticker (40 px or more)
Visible area is about 61% promotion and 39% branding. If you want promotions to dominate more, use Layout B.
10.2 Layout B - 'Immersive'. Image fills 1920 x 1080; a 1920 x 150 bottom bar (logo, website, ticker) plus a 320 x 320 corner QR panel overlay. Promotion images must follow a safe-zone template (keep text out of the bottom 150 px and the bottom-right corner). Higher impact, higher risk of covering text. Not the MVP default; layout profile is a setting.
10.3 QR size and distance (ASSUMED, test on the real TV). A common rule of thumb is scan distance of about 10 times the QR's physical width. The TV's physical screen size is PENDING. Example: on a 43-inch screen (about 95 cm wide) 260 px is about 13 cm, so roughly 1.3 m is comfortable; on 55 inches about 1.7 m. If customers stand further away, enlarge the QR or show only 2 QR codes.
10.4 Special screens
• Pairing screen: logo, 'Pair this TV', large 6-character code, countdown, 'Open Kathua Fresh admin > TV Devices > Pair new TV'.
• Welcome / fallback slide: branding-only slide shown when no valid promotion exists.
• Offline indicator: a tiny discreet dot in a corner (can be hidden in Settings); customers never see error dialogs.
• Fatal error: automatic WebView restart behind a branded 'Starting...' screen; never a raw browser error page.
10.5 Visual style: colours read from the existing Kathua Fresh brand tokens (to be taken from the website, not guessed), high contrast, price text 96 px or more in templates, and a locally bundled font with Devanagari support (for example Noto Sans and Noto Sans Devanagari) so text never depends on the internet.
11. User Journey
11.1 One-time setup (about 30-45 min, developer-assisted)
1. Verify TV hardware (Section 13). 2. Install the APK (Section 30). 3. Open 'Kathua Fresh TV Player' and the TV shows a pairing code. 4. Phone: Admin > TV Devices > Pair > enter code > Confirm. 5. TV shows the welcome slide. 6. Owner adds logo, website and QR links. 7. Voice test. 8. Reboot test.
11.2 Daily use (about 60 seconds) Open PWA > + New Offer > take photo or pick image > Title 'Onion Rs 40/kg' > Preview > Publish Now > confirm > TV shows it within seconds > Home shows an updated 'Last sync'.
11.3 Internet outage: TV keeps looping cached slides; admin shows 'TV offline since 14:02'; when internet returns the TV re-syncs only the changes.
11.4 Removing an offer: Offers > Onion > Delete > 'This removes it from the TV. The image file is kept if used elsewhere.' > Delete > gone from the TV at the next sync.
12. Technical Architecture
12.1 System diagram
  Owner phone (PWA)                Vercel (existing Next.js)               Supabase
 +------------------+  HTTPS   +-----------------------------+  server  +-------------------+
 | /admin/signage   |--------->| API routes /api/signage/*   |--------->| Postgres signage_ |
 | upload, edit,    |          | - admin: session + admin chk|          | Storage bucket    |
 | publish, preview |          | - device: device token      |          | Realtime broadcast|
 +------------------+          | - /tv  (display page)       |          +-------------------+
                               +--------------+--------------+                    ^
                                              | manifest JSON (ETag)              | ping 'version N'
                                              v                                   | (no content)
                               +-----------------------------+                    |
  Shop TV (MiTV-AXSO0)         | Kotlin WebView app          |<-------------------+
                               | - loads /tv                 |
                               | - disk image cache          |  fallback: poll /api/signage/manifest
                               | - Android TTS + MP3         |  every 30 s with If-None-Match
                               | - heartbeat, watchdog       |
                               +-----------------------------+
12.2 Reuse vs separate (framework; confirm by read-only audit)
Component
Recommendation
Why
Confirm by
Vercel project / Next.js app
Reuse the same app with new routes: /admin/signage/*, /tv, /api/signage/*
No new hosting cost; same deploy pipeline
Plan limits, function timeout, bandwidth; make sure existing middleware and auth redirects do not catch the new routes
Supabase project
Reuse if the plan has headroom; a second free project is a clean alternative
One bill, but isolation matters
DB size, storage quota, Realtime limits, project region
Postgres tables
Separate new tables prefixed signage_, no foreign keys into shop tables
Zero risk to orders and products
Read-only list of schema and RLS conventions
Storage
Separate new bucket signage-media
Different lifecycle, size rules and public/private policy
List existing buckets and policies
Admin authentication
Reuse existing admin login and server-side admin check; no second login
Same owner identity
How admin is identified (role claim, table or email allow-list); must be enforced server-side
Device authentication
New, independent of user auth (device token)
A TV must never hold a user session or service key
n/a
Realtime
Reuse Supabase Realtime Broadcast (ping only)
Cheapest push; very low message volume
Realtime enabled and quota
Service-role key
Server-side only (Vercel env vars); never on the TV or in any client bundle
Security rule
Confirm it is not in any NEXT_PUBLIC variable
AI Marketing Control Center work
Keep separate; do not merge signage into that branch
Different release risk
Branch and migration ordering
Read-only audit checklist (no changes): Supabase plan and usage page; list of tables and RLS; list of buckets; Realtime settings; auth providers; Vercel plan, usage, region and env var names (not values); existing middleware matcher; existing admin layout and components that can be reused; brand colours and logo assets; Next.js and Node versions; whether a PWA manifest or service worker already exists (a service worker scope clash with /admin/signage must be avoided).
12.3 Recommended stack
Layer
Choice
Mobile admin
Existing Next.js (App Router) + PWA, existing CSS approach, client-side image resize (canvas), qrcode library for QR SVG
TV display
Same Next.js app, route /tv, plain React, no heavy libraries, CSS opacity transitions, no animation library
TV app
Kotlin, minSdk 28, sideloaded (not Play Store) in MVP, no third-party libraries beyond AndroidX core
Backend
Supabase Postgres + Storage + Realtime Broadcast; Next.js route handlers
Voice
Android TextToSpeech (through a JS bridge) + native MediaPlayer for MP3
Validation
zod (or the validator already in use) on all API inputs
12.4 Alternatives considered
Option
Pros
Cons
Verdict
A. Kotlin WebView wrapper
Tiny; full control of audio, cache, auto-start and watchdog; layout changes are web deploys
One APK to build and sideload
Recommended
B. Open /tv in a TV browser
No APK
Address bar, sleep, blocked audio, no cache control, no auto-start
Rejected
C. Third-party kiosk browser app (for example Fully Kiosk Browser)
Quick prototype; kiosk and auto-start features
Licence terms and Android TV support must be checked; third-party dependency; less control of TTS
Only as a fast spike to test the TV before building the APK
D. Chromecast / Google Cast from phone
No app on TV
Needs the phone session; not autonomous; no offline
Rejected
E. Fully native Android UI
Lightest runtime, best offline
Every layout change needs an APK rebuild; preview and TV drift apart
Reconsider only if the WebView is too heavy for this TV
F. Commercial signage SaaS
Ready-made
Recurring fee, less control
Rejected on cost/control
13. Android TV Compatibility Report and Hardware Checklist (MiTV-AXSO0)
13.1 What the verified facts imply
• Android 9 / API 28: the WebView runs as a separate app. WebView 138 is a very recent Chromium, so modern CSS and JS are fine; the risk is memory and GPU speed of the TV, not features. Keep CSS simple and pre-size images to 1080p.
• Background start rules: restrictions on starting activities from the background arrived in Android 10, so a boot receiver is technically allowed on API 28, but Xiaomi TV firmware may add its own limits - PENDING test.
• Autoplay: WebView normally blocks audio without a user gesture; inside our own app we can switch that rule off and also route speech through native TTS, so autoplay is avoidable.
• WebView updates: on Android TV the WebView updates through the Play Store only if the TV has it and updates are on. The app reports the WebView version in its heartbeat.
13.2 Verification checklist (run once before coding)
#
Check
How
Result
H1
RAM total / available
Settings > Device Preferences > About, or adb shell cat /proc/meminfo
PENDING
H2
Low-RAM flag
adb shell getprop ro.config.low_ram
PENDING
H3
Free storage
adb shell df /data
PENDING
H4
Android / API
adb shell getprop ro.build.version.sdk (expect 28)
VERIFIED (owner)
H5
Resolution / density
adb shell wm size and wm density
1920x1080 VERIFIED
H6
WebView package and version
adb shell dumpsys webviewupdate
138.0.7204.179 VERIFIED
H7
Physical screen size
Measure the TV
PENDING (needed for QR sizing)
H8
Text-to-speech engine installed
Settings > Accessibility > Text-to-speech; adb shell pm list packages and look for tts
PENDING
H9
Hindi (hi-IN) voice present, offline data downloaded
TTS settings, 'Listen to an example' in Hindi
PENDING
H10
Dogri voice
Very unlikely in system TTS (ASSUMED); plan MP3
PENDING
H11
Install from unknown sources allowed
Settings > Device Preferences > Security and restrictions
PENDING
H12
ADB over network works
Developer options > network debugging
PENDING
H13
USB port reads a FAT32/exFAT drive
Install from a file manager
PENDING
H14
Boot auto-start of a sideloaded app
Test APK with boot receiver; reboot; observe
PENDING
H15
Sleep / screensaver / HDMI-CEC behaviour
Settings > Display, Power
PENDING
H16
Speaker loudness and clarity for Hindi speech
Play test MP3 and TTS at 30/50/70 percent
PENDING
H17
Network type and signal at TV location
Wi-Fi vs Ethernet, speed test, ping loss
PENDING
H18
Remote Back/Home behaviour
Manual
PENDING
H19
WebView smoothness (1080p cross-fade)
Run spike page for 1 hour
PENDING
H20
TV clock syncs with network time
Settings > Date and time
PENDING
Go / no-go rule: if free RAM is very low or the cross-fade stutters, set transitions to 'none' and reduce image size; if still poor, evaluate Option E (native rendering).
14. Lightweight APK Architecture
Components (single module, about 8 small Kotlin files)
Component
Responsibility
MainActivity
Single activity, landscape, LEANBACK_LAUNCHER and LAUNCHER intent filters, immersive sticky full-screen, keep-screen-on flag, hosts the one WebView
WebView setup
JS and DOM storage on, media gesture requirement off, hardware acceleration on, no zoom, only your own domain is navigable
Bridge (@JavascriptInterface)
Exposes only: speak(text, lang, volume), playMp3(url, volume), stopAudio(), getDeviceInfo(), reportError(), log(); no file or intent access
DeviceStore
SharedPreferences: device id, device token (Keystore-encrypted if feasible on API 28), pairing state
CacheManager
Downloads media by content hash into the app files dir; size cap with oldest-first eviction; deletes unreferenced files; atomic writes (temp file then rename)
RequestInterceptor
shouldInterceptRequest: serves cached media from disk, so the web layer behaves the same online and offline
TtsController
One TextToSpeech instance, audio-focus aware, single-flight queue, Hindi/English locale with fallback
AudioPlayer
One MediaPlayer for MP3, sharing the same single-flight queue
Watchdog
If the web layer misses its alive ping, reload; on render-process-gone recreate the WebView (not the app); crash-loop back-off
BootReceiver (optional)
Starts the activity on BOOT_COMPLETED; only enabled if H14 passes
Heartbeat
Status sent every 60 s through the web layer (no extra service)
Rules: no foreground or background service, no Room / Retrofit / Glide / Compose, one WebView only, WebView destroyed in onDestroy, no polling faster than 30 s.
Offline shell (important): if the TV is switched on while the internet is down, the hosted /tv page cannot load. Recommended: bundle a tiny fallback offline.html (plain JS, about 20-30 KB) in the APK that renders the cached manifest with the same layout. Trade-off: two renderers to maintain, but it is the only dependable way to get a branded working screen after a power cut that also took down the router. Alternative (less reliable): rely on the WebView HTTP cache and a service worker.
Distribution: sideloaded APK signed with your own key, with a version code; in-app update check is a Future item.
15. Database Schema (proposed, all new, prefix signage_)
No existing table is altered. Migrations will be written and reviewed only after approval.
Table
Key columns
signage_devices
id uuid, name, status (pending / active / disconnected / removed), token_hash, channel_key (random), paired_at, paired_by, last_seen_at, last_sync_at, current_version, app_version, android_sdk, webview_version, mem_class, free_storage_mb, cache_mb, current_slide_id, last_error
signage_pairing_codes
id, code (6 chars), device_id, poll_secret_hash, expires_at, claimed_by, claimed_at, attempts
signage_media
id, kind (image / audio / video), storage_path, mime, bytes, width, height, sha256, thumb_path, created_by, created_at, deleted_at
signage_promotions
id, title, price_text, media_id, duration_sec, starts_at, ends_at, status, enabled, notes, created_by, created_at, updated_at
signage_playlists
id, name, is_default
signage_playlist_items
id, playlist_id, promotion_id, position, duration_override_sec, enabled
signage_branding
id, logo_media_id, website_text, tagline, ticker_text, ticker_enabled, theme jsonb, layout_profile, updated_at
signage_qr_codes
id, label, target_url, caption, position, enabled
signage_announcements
id, type (welcome / offer / marketing), title, text, lang (hi-IN / en-IN), audio_media_id, promotion_id, enabled, repeat_every_sec
signage_voice_settings
id, master_enabled, volume, min_gap_sec, quiet_start, quiet_end, welcome_on_start
signage_publish_versions
id, version_no, snapshot jsonb, note, published_by, published_at
signage_commands
id, device_id, command (pause / resume / next / prev / reload / clear_cache / speak_test), payload jsonb, created_at, delivered_at
signage_device_events
id, device_id, level, type, message, at (keep about 30 days)
signage_audit_log
id, actor_id, action, entity, entity_id, meta jsonb, at
signage_play_log (Future)
device_id, promotion_id, started_at, duration - records plays, not customer views
Notes
• Draft vs live: editing tables hold working state; only signage_publish_versions.snapshot is what the TV reads, so the TV never sees half-edited or unapproved content.
• Indexes: signage_promotions(status, starts_at, ends_at), signage_playlist_items(playlist_id, position), unique signage_devices(token_hash), unique active signage_pairing_codes(code).
• RLS: enabled on every table with no anon or authenticated access policies; all access goes through server route handlers that first verify the admin or device token, so the TV never talks to tables directly. Policy style should follow your existing conventions (confirm in the audit).
• Storage: bucket signage-media. Recommendation: public-read with random UUID paths, admin-write only through the server, because the content is public marketing material and public URLs keep caching and offline simple. Alternative: private bucket with short-lived signed URLs (stronger, but expiring URLs complicate caching). This is a decision for you at approval.
• Multi-TV readiness without extra work now: device_id on devices, commands and events; playlists in their own table; a nullable device-to-playlist link can be added later. No multi-shop column is added.
16. API Specifications
Conventions: JSON over HTTPS; every body validated with a schema; errors as { error: { code, message } }; admin routes require the existing admin session and a server-side admin check; device routes require Authorization: Bearer <device token> and can only touch that device's own data; rate limits on pairing, login-adjacent and upload routes; Idempotency-Key header on publish.
16.1 Admin API (/api/signage/admin/...)
Method + path
Purpose
POST /media/upload-url then POST /media/confirm
Get an upload target, upload the resized image, then register it (server checks size, type signature, dimensions, computes sha256, makes thumbnail)
GET/POST /promotions, GET/PATCH/DELETE /promotions/:id
CRUD; DELETE is soft-delete first; file removal only after reference check and confirm
POST /promotions/:id/pause and /resume
Pause / resume one promotion
GET/PATCH /playlists/:id, POST /playlists/:id/reorder
Playlist items and order
GET/PATCH /branding, GET/POST/PATCH/DELETE /qr
Branding and QR settings
GET/POST/PATCH/DELETE /announcements, GET/PATCH /voice-settings
Voice content and settings
GET /preview
Draft manifest for the in-app preview
POST /publish
Validate -> snapshot -> new version -> broadcast ping -> audit entry
POST /publish/rollback
Re-publish a previous version
GET /devices, PATCH /devices/:id, POST /devices/:id/disconnect, DELETE /devices/:id
Device management
POST /pair/claim
Owner enters the 6-character code
POST /devices/:id/commands
pause / resume / next / prev / reload / clear_cache / speak_test
GET /monitoring
Summary numbers for the dashboard
16.2 Device API (/api/signage/device/...)
Method + path
Purpose
POST /pair/start
TV asks for a pairing code (no token yet)
GET /pair/status
TV polls with its poll secret until claimed, then receives its device token once
GET /version
Tiny response with the current version number (cheap to poll)
GET /manifest
Full manifest for the current version; supports ETag / If-None-Match (returns 304 if unchanged)
POST /heartbeat
Status every 60 s; response may carry pending commands
POST /ack
Confirms which version is now playing
POST /events
Errors and notable events (batched)
16.3 Manifest (what the TV reads - illustrative)
{
  "version": 14,
  "generated_at": "2026-10-30T07:10:00Z",
  "layout": "standard",
  "branding": {
    "logo": { "url": "...", "sha256": "..." },
    "website": "www.kathuafresh.in",
    "tagline": "...",
    "ticker": "...",
    "theme": {}
  },
  "qr": [
    { "label": "WhatsApp", "url": "https://...", "caption": "..." }
  ],
  "slides": [
    {
      "id": "...",
      "media": { "url": "...", "sha256": "...", "bytes": 412000 },
      "duration": 10,
      "starts_at": null,
      "ends_at": "2026-11-02T18:30:00+05:30",
      "announcement_id": null
    }
  ],
  "announcements": [
    { "id": "...", "type": "offer", "lang": "hi-IN", "text": "...", "mp3": null }
  ],
  "voice": { "enabled": true, "volume": 0.7, "min_gap_sec": 180, "quiet": null }
}
The manifest contains only what that device is allowed to display; no keys, no admin data.
17. Real-Time Synchronization
Question: Supabase Realtime or polling for one shop?
Option
Pros
Cons
Polling only (30 s, /version with ETag)
Simplest; works through any network; easy to debug
Up to 30 s delay; about 2,880 tiny requests per day per TV (check against Vercel limits)
Realtime only
Near-instant
Websocket can silently drop on TV networks; extra moving part; correctness depends on it
Hybrid (recommended)
Instant ping through Supabase Realtime Broadcast plus polling fallback so a missed ping never matters
Slightly more code
Recommended design
1. On Publish, the server increments the version and sends a Broadcast message version: N on the device's private channel key. The message carries no content.
2. The TV, on a ping or on its 30-second poll, calls /version; if it differs, it calls /manifest with If-None-Match.
3. The TV downloads only media whose sha256 is not already cached (delta), then swaps playlists atomically at the next slide boundary, then calls /ack.
4. Connection status = Realtime channel state + last successful poll. Last sync time = last successful /ack.
5. Reconnection: exponential back-off (5 s, 10 s, 30 s, capped at 60 s) with jitter; polling continues regardless.
6. Commands (pause, next, test voice) travel the same way: ping, then fetch via heartbeat/commands.
Why this is safe: a ping only says 'ask the server'; the server still checks the device token. Confirm Supabase's current Realtime authorization model for private channels during implementation.
Cost note: one publish produces one broadcast message; a small shop will publish a handful of times per day, far below typical limits (verify against your plan).
18. Offline Architecture
Layers
1. Manifest cache - last good manifest saved on disk by the native app.
2. Media cache - images and MP3 saved by content hash; served to the WebView by the interceptor.
3. Shell fallback - bundled offline.html renderer for cold boot without internet.
4. Local clock - used to evaluate start/end dates when offline.
Scenario
Behaviour
Internet drops while playing
Keep looping; show small offline dot; keep QR and branding; queue heartbeats/events
TV powered on without internet
Load offline.html + cached manifest + cached media
First ever launch without internet
Show branded 'Connecting...' and the pairing flow cannot proceed; nothing to cache yet (limitation)
Internet returns
Poll /version, download only changed media, swap at slide boundary, send queued events
Offer expires while offline
The player checks ends_at against the device clock every slide; expired slides are skipped even offline
All slides expired / none valid
Show the branded welcome slide (never blank)
Offer published or scheduled to start while offline
Cannot appear until the TV is online, because it was never downloaded; scheduled-future slides already in the cached manifest do start on time
Slide is deleted while TV offline
Keeps showing until the TV syncs (limitation, shown in admin as 'TV offline - change not yet applied')
Cache full
Evict oldest media not in the current manifest; never evict current media
Corrupt download
Verify sha256; discard and retry; keep the old file
Clock risk: if the TV clock is wrong (no network time after a power cut), expiry decisions may be wrong. Mitigation: heartbeat compares device and server time; if they differ by more than a few minutes the admin sees a warning, and the player uses the server time offset from the last successful sync.
Limitations to accept: offline TTS depends on a Hindi voice pack already installed (H9); anything not yet cached cannot be shown; remote commands do not reach an offline TV; the owner sees 'offline' only after the heartbeat times out (about 2-3 minutes).
19. Voice Announcement Architecture
19.1 Options compared
Option
Hindi
Offline
Cost
Reliability on TV
Verdict
Android native TextToSpeech
Depends on installed engine and voice (PENDING H8, H9)
Yes if voice data downloaded
Free
Good once verified
MVP primary for text
Browser SpeechSynthesis in WebView
Same engine underneath, but autoplay and WebView quirks
Same
Free
Weaker than native
Not used
Pre-recorded MP3
Any language including Dogri
Yes, fully cached
Free (your voice or a recorded clip)
Excellent
MVP for important and Dogri lines
Cloud TTS APIs
Often better voices
No
Recurring per-character cost (check current pricing)
Needs internet
Future option only; generate MP3 once, then cache
Dogri: system TTS support for Dogri is not expected (ASSUMED, verify on the TV). Use a recorded MP3 for Dogri lines.
19.2 How it works
• Owner writes announcements in the admin (text or MP3). Tip: write Hindi in Devanagari (for example 'नमस्कार! कठुआ फ्रेश में आपका स्वागत है'); Roman Hindi often gets pronounced badly by TTS engines. The admin offers a [Test on TV] button and a note about this.
• Voice settings: master switch, volume, minimum gap (2 / 3 / 5 / 10 min), quiet hours, welcome on start.
• Scheduler (in the web layer, one timer): every 5 seconds check: voice enabled, not quiet hours, nothing currently speaking, time since last announcement >= min gap, then pick the next eligible announcement (rotation; linked announcements preferred when their slide is on screen). Call Android.speak or Android.playMp3.
• Single-flight queue (native): if audio is playing, new requests are dropped (not queued forever) so announcements never overlap or pile up. A playing announcement is never interrupted, except by an explicit admin 'Stop'.
• Audio focus: request transient focus; release when done.
• First-time audio activation: inside our own app, autoplay restrictions are disabled and TTS is native, so no tap is needed. For the browser preview on the phone, a clear 'Tap to enable sound' button is shown. Fallback if the TV firmware still blocks audio: a one-time 'Press OK on the remote to enable sound' screen at first pairing (to be tested on H16).
• MP3 guidelines: mono, 44.1 kHz, 64-128 kbps, loudness-normalised, 30 s or shorter, under about 1 MB.
19.3 Acceptance
Announcement is audible and clear from customer position; never overlaps; frequency obeys the setting; no repetition of the same line back-to-back; stops at quiet hours; survives reboot (settings come from the manifest).
20. Device Pairing Architecture
TV app                    Server                         Owner phone
  | POST /pair/start ---->  | create code (6 chars, 10 min),
  |<--- code + poll secret  |  store hashed poll secret
  | shows code on screen    |                              enters code in admin
  | GET /pair/status (poll) |<------------- POST /pair/claim (admin session)
  |                         | verify code, expiry, attempts
  |<--- device token (once) | create device, store token hash
  | saves token securely    |
  | GET /manifest (Bearer)  | -> content
• Code: 6 characters from an unambiguous alphabet (no 0/O/1/I), about 31 options per position; valid 10 minutes; single use; claim attempts rate-limited (for example 5 wrong tries then the code is burned).
• Device token: random 256-bit value, shown to the TV only once; the server stores only its hash; revocable instantly (Disconnect/Remove).
• Authorized devices only: device routes reject unknown, disconnected or removed tokens.
• Re-pairing: a TV that lost its token (cleared data) generates a new code; the old device record can be re-linked or removed by the owner.
• Future multi-TV: pairing is already per device; additional TVs reuse the same flow.
21. Security Design
Area
Control
Admin access
Existing admin login; server-side admin check on every admin route; no admin UI shipped to the TV
Device access
Bearer device token; hash stored; scoped to its own manifest and heartbeat; revocation
Secrets
Service-role key only in Vercel server env; never in the APK, client bundle or NEXT_PUBLIC variables
Database
RLS enabled with no direct client policies; server routes only; parameterised queries
Uploads
Allow-list JPG/PNG/WebP (and MP3 for audio); verify magic bytes; size and dimension limits; re-encode server-side or client-side to strip metadata; random UUID filenames; no SVG uploads (script risk)
Media URLs
Public-read with unguessable paths (default) or signed URLs (alternative); no listing
Input validation
Schema validation on every route; length limits; QR URLs must be http/https only
WebView hardening
Only your domain loadable; no file access; JS bridge exposes minimal methods; bridge calls checked by origin; disable remote debugging in release builds
Abuse protection
Rate limits on pairing, claim, upload, publish, heartbeat
Auditing
Audit log for login, publish, rollback, delete, QR change, pair, disconnect, remove
Privacy
No customer data is collected by the TV system; no camera/microphone permissions requested
Transport
HTTPS only; cleartext traffic disabled in the APK
Backups
Include signage_ tables and bucket in whatever backup routine already exists (confirm)
22. UI/UX Design Guidelines
Admin (mobile): one primary action per screen; minimum 48 px tap targets; Hindi/English labels (optional toggle); clear status colours (green live, amber scheduled, grey draft, red expired/error); confirmation sheets for publish, delete, device removal; undo toast for pause; no jargon ('Show for 10 seconds', not 'duration_sec'); works one-handed; offline-tolerant drafts.
TV (customer view): 10-foot rules - body text 40 px or more, prices 96 px or more, high contrast (minimum 4.5:1), keep to a few words per slide, avoid tiny disclaimers; keep important content inside a 5% safe margin (TVs overscan); pastel backgrounds avoided behind QR; cross-fade 600 ms; no spinning or flashing (can cause visual discomfort and wastes GPU); ticker speed slow enough to read; consistent brand colours and logo placement.
Image template guidance (included in the admin help): 1920 x 1080 px, text in the central safe area, one price per slide, 3 colours max, dark text on light or white text on dark.
23. Hosting and Infrastructure
• Vercel (reuse): new routes inside the existing Next.js project. /tv is a lightweight client page; /version and /manifest are small, cacheable with ETag. Check function invocation and bandwidth quotas for 2,880 version checks per day per TV plus heartbeats (about 1,440 per day) - small, but confirm on your plan.
• Supabase (reuse if headroom): Postgres for tables, Storage for images/MP3, Realtime Broadcast for pings. Confirm project region and the free-tier limits that apply to storage, egress and Realtime.
• Media delivery: images are already resized to about 300-700 KB; the TV downloads each file once and caches it, so egress stays low.
• Environments: develop on a feature branch and a separate preview deployment; use a staging Supabase project or schema-isolated tables for testing if possible; never test against production data.
• Observability: Vercel logs, Supabase logs, signage_device_events.
• Deployment safety: all signage routes are additive; a feature flag (environment variable) can disable /tv and /api/signage/* without touching the shop; rollback = revert the deployment.
24. Cost Analysis
Honesty note: I did not look up live prices and I do not invent figures. Below is the structure of cost and what to check. Fill in numbers during the audit from the official Vercel and Supabase pricing pages and your own dashboards.
A. One-time development
Item
Cost driver
Effort estimate (ASSUMED, one experienced developer)
Audit and hardware spike
Developer time
3-4 person-days
Database + API + pairing
Developer time
5-7 person-days
Mobile admin PWA
Developer time
8-10 person-days
TV display + Kotlin APK
Developer time
8-10 person-days
Offline + voice
Developer time
6-8 person-days
Hardening, testing, 24-hour soak
Developer time
5-6 person-days
Install, pilot, training
Developer time
2-3 person-days
Total

about 37-48 person-days (roughly 8-10 calendar weeks)
If the developer is you or an existing contractor, this is time; if hired, multiply by the agreed day rate. Android Studio and the Android SDK are free. A Play Store account is not needed (sideloading).
B. Monthly infrastructure (check the current plan limits)
Item
Expected load
What to check
Vercel
Roughly 2,880 version checks + 1,440 heartbeats per TV per day, all tiny
Function invocations, bandwidth, plan fair-use terms
Supabase database
A few thousand rows per year
Database size cap
Supabase storage
Perhaps 50-200 images at about 0.5 MB, plus a few MP3
Storage quota
Supabase egress
Each TV downloads each file once, then caches
Egress quota
Supabase Realtime
A few broadcast messages per day, 1 TV connected
Concurrent connections and message limits
Domain, SSL
Existing
Nothing new
Expectation: for one TV this should fit within existing plan allowances, but this is an assumption until the audit confirms it.
C. Optional paid services (not in MVP)
Cloud TTS (per-character pricing - generate once, cache as MP3); video hosting or larger storage tier if you add video; a hardware fix such as an Android TV box or streaming stick if the TV proves too weak (verify first); a Supabase/Vercel plan upgrade if you outgrow limits; a licence if you choose a third-party kiosk app instead of your own APK.
D. Free alternatives used
Android native TTS, recorded MP3, Supabase Realtime Broadcast, WebView (no framework), open-source QR library, system fonts or bundled open fonts (Noto), sideloading instead of the Play Store, Vercel/Supabase existing plans.
E. Hardware extras to consider (verify need)
USB drive for APK install; Ethernet adapter or wired port if Wi-Fi is weak; a surge-protected power strip; optional UPS for outage tolerance.
25. MVP Scope
In MVP
Not in MVP
Mobile admin PWA with all 11 sections in simple form
Multiple playlists, per-TV content
Pairing, device status, heartbeat
Video ads, background music
Image upload (camera/gallery), CRUD, reorder, durations, schedule, expiry
Advanced voice scheduling, cloud TTS
Draft / preview / approve / publish, rollback to last version
Staff roles and second-person approval
One playlist, loop, pause/resume/next/prev
Per-slide transition styles
Permanent branding, configurable QR codes (2 + 1 extra), ticker
Layout editor / extra themes
Hindi/English TTS, MP3 playback, frequency, volume, no-overlap
Play-count analytics, campaign history
Offline cache, local expiry, branded fallback, reconnection
Auto-update of the APK
Basic monitoring numbers and audit log
Multi-language UI beyond Hindi/English
1080p full-screen, Layout A (Layout B optional)
Screenshots of the TV screen
26. Future Roadmap
Phase
Theme
Items
1 (MVP)
Reliable single-TV signage
Section 25
2
Richer content
Video ads (short MP4, pre-cached), background music with ducking under announcements, templates for price banners
3
Multi-TV
Device-to-playlist assignment, groups, per-TV announcements, bulk commands
4
Smarter operations
Festival campaign kits, advanced voice scheduling, staff roles, APK self-update
5
Insight
Play-count and campaign history (plays, not views), optional QR short-links with scan counts via a tracked redirect (disclose this)
27. Development Milestones
#
Milestone
Exit criteria
Approx. duration
M0
Read-only audit + hardware spike
Checklist H1-H20 complete; WebView page runs for 1 hour with cross-fade; TTS and MP3 test results; go/no-go on WebView
3-4 days
M1
Backend foundation
Migrations approved and applied on a safe environment; pairing and manifest APIs working; RLS verified
1-1.5 weeks
M2
Admin PWA
Upload, CRUD, preview, publish, QR, devices, voice screens functional on a real phone
2 weeks
M3
TV player
APK shows /tv, caches media, full-screen, heartbeat, reconnect
2 weeks
M4
Offline + voice
Tests 8-12 pass
1-1.5 weeks
M5
Hardening
Security checks, 24-hour soak, memory profile, Tests 1-16 pass
1 week
M6
Pilot and go-live
Installed in shop, 3 days supervised, owner training
3-5 days
28. Testing Strategy
Levels: unit tests (date/expiry logic, scheduler, validation), API integration tests (auth, pairing, manifest, RLS), device tests on the real MiTV-AXSO0, and a 24-hour soak test. All tests run against a safe environment first, never against live shop data.
28.1 Acceptance tests
#
Test
Steps
Expected result
Pass / Fail condition
1
Upload onion promo from mobile
Phone > New Offer > Camera or Gallery > title 'Onion Rs 40/kg' > Save as Draft
Image resized to 1080p-class, appears in Offers as Draft, not on TV
Pass: draft exists, TV unchanged. Fail: appears on TV or upload errors
2
Publish appears on TV without refresh
Press Publish Now and confirm
TV shows the slide in its next rotation; target <= 5 s (Realtime) or <= 30 s (poll)
Pass: slide shown within 30 s with no manual action. Fail: needs refresh or > 60 s
3
Edit offer
Change price text/image, publish
TV shows updated slide; old image no longer shown
Pass: updated content visible. Fail: old content persists after 60 s
4
Delete offer
Delete with confirmation
Slide disappears from TV; shared image used by another promotion is kept
Pass: gone from loop, shared file intact. Fail: still shown, or other promo broken
5
Multiple images slideshow
Upload 5 images with different durations
Plays in order, each for its duration, loops, no black frame
Pass: order and timings within +/- 1 s; no black frame. Fail: wrong order, gaps or blank
6
QR visible on every slide
Watch a full loop (and the welcome slide)
WhatsApp and Instagram QR visible, undistorted, on every slide
Pass: 100% of slides. Fail: any slide without QR or stretched QR
7
Scan QR from another phone
Scan from 1 m, 2 m and the usual customer distance
Opens the correct WhatsApp/Instagram link
Pass: scans at the intended distance on 2 different phones. Fail: fails at intended distance
8
Hindi voice through TV speakers
Send Hindi text, press Test on TV; run at frequency 2 min
Clear Hindi speech, correct volume, interval respected
Pass: intelligible to listener in shop; no overlap. Fail: wrong language voice, silent or overlapping
9
MP3 playback
Upload MP3 announcement and play
Plays fully at set volume; does not overlap TTS
Pass: full playback once per trigger. Fail: cut off, repeats or overlaps
10
Offline playback
Disconnect router for 30 min
Slides, branding and QR keep looping; no error dialogs; offline dot visible; admin shows offline within about 3 min
Pass: no blank screen for 30 min. Fail: blank, error page, crash
11
Restore internet sync
Make a change while TV is offline, then reconnect
TV syncs within 60 s, downloads only changed media
Pass: change visible, only delta downloaded. Fail: not updated or full re-download
12
TV restart recovery
Power-cycle TV (with and without internet)
App relaunches (if auto-start verified) or opens from launcher; shows cached playlist
Pass: playlist playing within 60 s of app start. Fail: needs reconfiguration or repairing
13
24-hour continuous run
Run 24 h with 10 s slides, voice every 5 min
No crash, no memory growth beyond budget, no frozen slide
Pass: zero unrecovered crashes; slide still advancing at hour 24. Fail: freeze, black screen or restart loop
14
RAM and performance
adb shell dumpsys meminfo at start, 1 h, 12 h, 24 h; observe transitions
Memory stable (no upward trend), transitions smooth
Pass: memory within the budget set after H1 and growth under about 10% across the run. Fail: steady growth or visible stutter
15
Preview and approval
Edit without publishing; open preview; then approve and publish
Draft changes never reach the TV before Publish; preview matches live render
Pass: TV unchanged until Publish. Fail: any unapproved content on TV
16
Unauthorized control blocked
Call admin APIs without login, with a non-admin user, and with a device token; use an invalid or removed device token
401/403 for all; removed device can no longer fetch manifest
Pass: all rejected. Fail: any success
28.2 Additional tests
#
Test
Pass condition
17
Offer expires while TV offline
Slide is skipped at its end time using device clock
18
Pairing code expiry and brute force
Expired code rejected; 5 wrong tries burn the code
19
Upload validation
Renamed .exe or oversize file rejected; SVG rejected
20
Two announcements due at once
Second is skipped or delayed, never overlapping
21
Wrong device clock
Admin shows clock-skew warning
22
Crash recovery
Kill WebView render process: player returns within 30 s
23
Cache eviction
Cache at limit: oldest unreferenced file removed, current slides intact
24
Existing shop regression
Product pages, checkout and existing admin work unchanged after deploy
25
Disconnect / remove device
TV falls back to pairing screen after token revoked
29. Risk Analysis
#
Risk
Likelihood
Impact
Mitigation
R1
TV has low RAM and WebView stutters or crashes
Medium (RAM unknown)
High
Hardware spike first; lighter transitions; smaller images; watchdog; fallback to native renderer or an Android TV stick
R2
Boot auto-start blocked by Xiaomi firmware
Medium
Medium
Test H14; fallback: set the app as the first launcher row, or owner opens it after power-on; document honestly
R3
Audio blocked or no Hindi TTS voice
Medium
Medium
Native TTS test H8-H9; MP3 fallback; recorded announcements
R4
TV clock wrong offline
Low-Medium
Medium
Server-offset logic, skew warning
R5
Realtime connection drops silently
Medium
Low
Polling fallback always on
R6
New routes break the live shop (middleware, bundle size, env vars)
Low
High
Additive routes, feature flag, preview deployment, regression test 24
R7
Supabase/Vercel free-tier limits exceeded
Low
Medium
Audit limits, cache aggressively, monitor usage
R8
Owner publishes a wrong price
Medium
Medium
Preview + confirm; rollback to previous version; price text shown in confirm sheet
R9
Image too heavy for TV
Medium
Medium
Client resize, size cap, thumbnails in admin only
R10
WebView version drift or update breaks rendering
Low
Medium
Report version in heartbeat; keep CSS conservative
R11
Device token stolen from TV
Low
Medium
Token only reads manifest; revocable; no admin power
R12
Scope creep
Medium
Medium
Strict MVP list (Section 25)
R13
Offline cold boot with no cached data
Low
Low
First run requires internet; documented
R14
Kiosk escape through remote (Home button)
High
Low
Cannot fully prevent on stock Android TV; document and train staff; optional lock-down through ADB device-owner is not promised
30. Deployment and Installation Guide
(Menu names vary by firmware; this will be finalised after the hardware spike. Nothing here is executed yet.)
30.1 Prepare the TV
1. Connect TV to stable Wi-Fi or Ethernet. Enable automatic date and time.
2. Settings > Device Preferences > About: tap Build 7 times to enable Developer options.
3. Developer options: turn on USB debugging (and network debugging if listed).
4. Settings > Device Preferences > Security and restrictions: allow installs from unknown sources for the installer you use (file manager).
5. Display/Power: set screensaver and sleep timers to Never where available (names vary).
30.2 Install method A - ADB over network (preferred)
1. On a laptop, install Android platform-tools.
2. Find the TV IP address in Settings > Network.
3. adb connect <TV_IP>:5555 and accept the prompt on the TV.
4. adb install -r kathua-fresh-tv.apk
5. Launch from the TV app row, or adb shell monkey -p <package-name> 1 (package name to be defined in implementation).
30.3 Install method B - USB drive Copy the APK to a FAT32/exFAT USB drive, plug into the TV, open with a file manager app, allow install, open the app.
30.4 First run
1. Open Kathua Fresh TV Player; note the 6-character pairing code.
2. Phone: Admin > TV Devices > Pair new TV > enter code > Confirm.
3. Set logo, website, QR codes; publish a test playlist; run voice test.
4. Run the hardware verification checklist results back into the PRD.
30.5 Reliability set-up If H14 passes, enable boot start; disable battery/power-saving restrictions for the app if present; keep the TV on the same power strip as the router; optional HDMI-CEC off to prevent unwanted sleep.
30.6 Updating and rollback Web changes (layout, features) deploy through Vercel with no TV action. APK updates: adb install -r the new APK; keep the previous APK file for rollback. Content rollback: Admin > Publish history > Restore version.
30.7 Honest limits: unrestricted kiosk mode and boot auto-start are not promised; the Home button on the remote can exit the app.
Decisions I need from you at approval
#
Decision
My recommendation
D1
Reuse the existing Supabase project or use a separate one?
Reuse if the audit shows headroom; separate tables and bucket either way
D2
Public-read media bucket (random paths) or signed URLs?
Public-read with random paths for MVP
D3
Default layout: Standard (about 61% promo) or Immersive?
Standard for MVP; Immersive as a setting
D4
Include the bundled offline fallback player?
Yes
D5
Run the hardware spike (Option C kiosk browser or a test page) before building the APK?
Yes, first
D6
Single admin only in MVP?
Yes
D7
Dogri via recorded MP3 only?
Yes
D8
Preferred languages for admin labels (Hindi / English / both)?
Both, with a toggle
D9
TV physical size and viewing distance (for QR size)?
Please measure
Deliverables map (A to K)
Deliverable
Where
A. Complete PRD
This document (Sections 1-30)
B. Recommended lightweight architecture
Sections 12.1, 12.4, 14
C. Technology stack
Section 12.3
D. Database schema and API design
Sections 15, 16
E. Mobile and TV wireframes
Sections 9, 10
F. MiTV-AXSO0 compatibility checklist
Section 13
G. Installation instructions
Section 30
H. Development timeline
Sections 24-A and 27
I. Cost estimates
Section 24 (structure; no invented prices)
J. Prioritised roadmap
Sections 25, 26
K. Next-phase implementation prompt
Appendix K below
Appendix K - Implementation Prompt for the Next Phase (use only after you approve this PRD)
ROLE: Senior Next.js / Supabase / Android TV engineer.

CONTEXT: Kathua Fresh (www.kathuafresh.in) is an existing production Next.js
site on Vercel with Supabase. We are adding a Digital Signage system per the
approved PRD 'Kathua Fresh Smart Digital Signage System - PRD v1.0'.
TV: Xiaomi MiTV-AXSO0, Android TV 9 (API 28), 1920x1080, WebView 138.0.7204.179.

PHASE 0 ONLY (read-only audit + planning). Do NOT modify files, database,
Supabase settings or deployments. Do NOT install packages or run migrations.

TASKS
1. Confirm the git working tree is clean; report current branch. Create a new
   branch feature/digital-signage only if it does not already exist and only
   after reporting what you will run.
2. Read-only audit of the repository: Next.js version, router type, middleware
   matcher, admin auth and admin-check implementation, existing PWA manifest /
   service worker scope, Tailwind/UI components, brand colour tokens and logo
   assets, env var NAMES (never values), existing Supabase client usage,
   existing RLS conventions and migrations folder layout.
3. Produce an audit report: what to reuse, what must stay separate, conflicts
   (routes, middleware, service worker), and any exposed secrets risk.
4. List the exact Supabase and Vercel plan limits I should check (storage,
   egress, Realtime, function invocations) and the dashboard pages to open.
5. Draft (as text only, not applied) the SQL migration for the signage_ tables
   from PRD Section 15, with RLS enabled and no client policies, a rollback
   script, and an index list.
6. Draft the route list, zod schemas and manifest JSON for PRD Section 16.
7. Draft the hardware spike plan: a minimal /tv test page (cross-fade,
   1080p) and the ADB commands for checklist H1-H20.

CONSTRAINTS
- Additive changes only; nothing touches existing shop tables, routes or buckets.
- No service-role key or DB credentials in the APK or any client bundle.
- Every publish requires owner approval; no auto-publish.
- Mark every statement as VERIFIED, ASSUMED or PENDING.

OUTPUT: the audit report, draft migration text, API draft, spike plan.
Then STOP and wait for my explicit approval before Phase 1.