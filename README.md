# StudyFlow ✦

**An AI-assisted study planner that turns exam-season chaos into a calm, prioritized plan for university students.**

🔗 **[Live App](https://getstudyflow.netlify.app)** &nbsp;·&nbsp; 📖 **[Full Case Study](https://nitheshl-portfolio.netlify.app/studyflow.html)**

StudyFlow helps students answer the hardest question of exam season: *what should I study right now?* It ranks subjects by exam proximity and readiness, auto-builds an editable weekly plan, runs focus sessions, and turns real study activity into progress insights. I built it end to end as a product management portfolio project: discovery, competitive analysis, MVP scope, metrics, and the full build.

---

## The problem

Students do not fall behind for lack of time. They lose momentum to the daily overhead of *planning*. Juggling several modules with different exam dates and readiness levels, the decision of what to prioritize each day is exhausting, and generic to-do apps or Notion pages add setup cost instead of removing it.

## What it does

- **Smart suggestion.** Ranks every subject by exam proximity weighted against your readiness gap, and tells you what to study first today.
- **Readiness tracking.** Each subject carries a single percentage, turning vague exam anxiety into a visible, trackable number.
- **Editable weekly plan.** Auto-fills a week of study blocks from your exam dates, then lets you tweak any day.
- **Focus mode.** A Pomodoro timer scoped to a subject that logs every completed session.
- **Honest analytics.** Focus time, a consistency heatmap, readiness, and completed tasks, all built from real behavior and starting empty for new users.
- **Real accounts.** Google and email sign-in with per-user cloud sync across devices.

## Screenshots

**Dashboard**
![StudyFlow dashboard](screenshots/studyflow-dashboard.png)

**Weekly plan**
![StudyFlow weekly plan](screenshots/studyflow-plan.png)

**Focus timer**
![StudyFlow focus timer](screenshots/studyflow-focus.png)

**Progress insights**
![StudyFlow stats](screenshots/studyflow-stats.png)

## A note on the "AI"

The suggestion engine is **rule-based**, not a machine-learning model. It prioritizes by exam proximity multiplied by readiness gap. I positioned this honestly because, for a study tool, a transparent rule a user can understand builds more trust than an opaque algorithm, and it ships faster. A future version could learn from real session history once there is enough data.

## North Star Metric

**Weekly Active Studiers (WAS):** users who complete three or more focus sessions in a week. It measures the habit the product exists to create, not vanity signups.

## Tech stack

- **Frontend:** Vanilla HTML, CSS, and JavaScript (no framework)
- **Auth and database:** Firebase Authentication and Cloud Firestore
- **Hosting:** Netlify, deployed from this repo

## Run it locally

1. Clone this repository.
2. Serve the folder over http, for example with the VS Code **Live Server** extension. Do not open `index.html` directly with `file://`, because Firebase authentication requires an http or https origin.
3. The Firebase web config is already included. Web API keys are public by design; access is secured by Firestore security rules, not by hiding the key.

## Product management process

This was built as a product management portfolio project, not just an app. The full case study covers problem framing, user discovery and personas, competitive analysis, MVP scoping and feature trade-offs, the metrics framework, and what I learned:

👉 **[Read the full StudyFlow case study](https://nitheshl-portfolio.netlify.app/studyflow.html)**

**Skills demonstrated:** problem framing · user discovery · competitive analysis · MVP scoping · feature prioritization · metrics definition · end-to-end execution · honest communication of AI capabilities.

## About

Built by **Nithesh Lokesh**, M.Sc. student and aspiring Product Manager based in Berlin.

📧 nitheshinde@gmail.com &nbsp;·&nbsp; 💼 [LinkedIn](https://linkedin.com/in/nithesh-l-644252219)
