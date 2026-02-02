# Local Dashboard

A lightweight, local‑first personal dashboard: tasks, projects/learning, journal, calendar, hobbies, quick links, and a pomodoro timer — all stored in your browser.

## What it includes
- **Home**: quick links to every module + at‑a‑glance previews.
- **To‑Do**: priorities, due dates, tags, linked items, schedule view, archive.
- **Projects/Learning**: projects + learning entries with notes, tags, linked items, weekly schedule, and a Gantt timeline.
- **Journal**: daily entries with tags + linked items; inline slash‑links.
- **Calendar**: month/week views built from tasks, projects, and hobbies.
- **Hobbies**: streak tracking and weekly schedule.
- **Quick Links**: editable shortcuts.
- **Pomodoro**: focus sessions with logs + optional project linking.

## Time zone behavior (user‑local by default)
All dates/times render in the **user’s local time zone** by default.

If you want a fixed time zone or a user‑selectable setting, the key spots are:
- `dashboard.js`: world‑clock display (`timeZones` array) and formatting (`formatDateTime`, `formatTimeOnly`).
- `journal.js`: daily entry key (`todayKey()`) currently uses UTC. If you want local‑date keys, change it to build from local date parts.
- `todo.js` + `calendar.js`: formatting uses `toLocaleString()` (local). Add `timeZone` to `Intl.DateTimeFormat` if you want a fixed zone.

## Tagging + linking (fast)
Use slash commands inside **notes/details** fields:
- `/project:`, `/learning:`, `/task:`, `/hobby:` to link items
- Type `/` or `\` to see options

Tags are comma‑separated in tag fields and stored as arrays.

## Data storage
All data is stored locally in the browser (LocalStorage + IndexedDB sync).

Reset local data (once): open any page with `?reset=1`, then remove the query param.

## Quick start
Open `index.html` in a browser. No build step required.

## Publish to GitHub (quick)
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
# create a repo on GitHub, then:
git remote add origin <your-repo-url>
git push -u origin main
```

---

If you want a single global time‑zone setting stored in the UI, I can add that.
