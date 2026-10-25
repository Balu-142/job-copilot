# 🚀 JobCopilot Pro - 24/7 Cloud Deployment Guide

This document provides complete documentation on how **JobCopilot Pro** is deployed and maintained 24/7 on the cloud without requiring a local machine to be turned on.

---

## 🌐 Official Production Deployment

| Metric | Details |
| :--- | :--- |
| **Production URL** | [**https://job-copilot-p1b0.onrender.com**](https://job-copilot-p1b0.onrender.com) |
| **Candidate** | **Bala Gurunadham Pamba** (Senior Flutter / Lead Mobile Engineer) |
| **Hosting Platform** | **Render.com** (Free Web Service Tier) |
| **Cloud Region** | Singapore / Frankfurt Global Edge |
| **Runtime Environment** | Node.js (Linux Container) |
| **Source Code Repository** | [https://github.com/Balu-142/job-copilot](https://github.com/Balu-142/job-copilot) |
| **Deployment Branch** | `main` |
| **Status** | 🟢 **ACTIVE & ONLINE 24/7/365** |

---

## 💡 How 24/7 Cloud Hosting Works (Zero-Laptop Dependency)

Unlike local tunnels (such as Cloudflare Quick Tunnels or ngrok) which run directly inside your laptop's memory and disconnect whenever your laptop goes to sleep or turns off:

1. **Cloud Server Infrastructure**:  
   JobCopilot Pro runs inside an isolated, containerized Linux virtual machine hosted inside Render's global cloud data centers.
2. **Always-On Availability**:  
   The server operates **24 hours a day, 7 days a week**. You can close your laptop, turn it off completely, travel, or be without internet—the website, scraper APIs, and resume downloads stay 100% active worldwide.
3. **Global CDN & SSL**:  
   Automated HTTPS/SSL certificates are provisioned and renewed automatically by Render edge proxies.

---

## 🔄 Automatic Continuous Deployment (CI/CD)

Whenever you make improvements or changes to your project code locally:

1. Stage and commit your code:
   ```bash
   git add .
   git commit -m "Update feature or candidate details"
   ```
2. Push to GitHub:
   ```bash
   git push origin main
   ```
3. **Render Automatically Redeploys**:  
   Render detects the new commit via GitHub webhooks, runs `npm install`, verifies the build, and publishes the update live with **zero downtime**.

---

## ⚙️ Configuration Files Explained

### 1. `render.yaml`
Specifies infrastructure-as-code for Render:
```yaml
services:
  - type: web
    name: jobcopilot-bala-flutter
    env: node
    buildCommand: npm install
    startCommand: npm start
    plan: free
    envVars:
      - key: PORT
        value: 10000
```

### 2. `Procfile`
Declares the web process execution entry point:
```
web: node backend/server.js
```

### 3. `backend/server.js`
Listens on `process.env.PORT` dynamically and binds to `0.0.0.0` to receive inbound traffic from Render's edge router.

---

## 📡 Live Endpoints & Features

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Main JobCopilot Web Dashboard (Dark Mode, 95+ Live Matches) |
| `/api/jobs` | `GET` | Real-time multi-platform aggregated Flutter job listings |
| `/api/profile` | `GET` | Candidate profile metadata (Bala Gurunadham Pamba) |
| `/api/resume/view` | `GET` | Inline browser viewer for ATS-optimized PDF resume |
| `/api/resume/download` | `GET` | Direct download attachment of PDF resume |
| `/healthz` | `GET` | Uptime and container health check probe |

---

## 🛠️ Local Development vs Cloud Deployment

| Feature | Local Development | Cloud Production |
| :--- | :--- | :--- |
| **URL** | `http://localhost:3500` | `https://job-copilot-p1b0.onrender.com` |
| **Laptop Dependency** | Requires laptop ON | **Laptop can be completely OFF / Closed** |
| **Access Scope** | Only your computer | **Open to recruiters & mobile devices worldwide** |
| **Command** | `npm start` or `npm run share` | Automated via Render CI/CD |

---

## 👤 Candidate Contact
- **Developer**: Bala Gurunadham Pamba
- **Role**: Senior Flutter Developer / Mobile Lead (3+ Years Experience)
- **LinkedIn**: [linkedin.com/in/balu142](https://linkedin.com/in/balu142)
- **Email**: balupamba1@gmail.com
- **Phone**: +91 6302125421
