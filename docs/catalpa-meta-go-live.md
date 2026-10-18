# Catalpa Meta go-live (from zero)

**Goal:** First Click-to-WhatsApp ad for Catalpa → lead lands in the `catalpa` dogfood bot → you see it on the dashboard.

LinkedIn is already done. Do these steps in order. Finish one sitting per step.

---

## 1. Create Meta Business Manager for Catalpa

Go to [business.facebook.com](https://business.facebook.com/) while logged into your Facebook. Create a **Business Manager** named **Catalpa Automations** (Ghana). Add your work email. Stop when the Business Manager home loads.

## 2. Create a Meta (Facebook) Page for Catalpa

In Business Manager → **Pages** → create (or claim) a Facebook Page for **Catalpa Automations**. You need this Page to run WhatsApp Business and ads.

## 3. Open Meta for Developers and create an app

Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps** → **Create App**. Choose a business type tied to your new Business Manager. Name the app **Catalpa WA**. Finish until the app dashboard opens.

## 4. Add WhatsApp to the app

In the app dashboard → **Add product** → **WhatsApp** → set up. Connect it to your Business Manager. Note the test phone number Meta gives you (fine for first webhook tests).

## 5. Deploy the Catalpa lead bot and copy the webhook URL

Run the spine with tenant `catalpa` on a public HTTPS host (Railway, Render, etc.):

```bash
TENANT_ID=catalpa WHATSAPP_MODE=cloud npm start
```

Your webhook URL is:

`https://YOUR_HOST/webhooks/whatsapp?tenant=catalpa`

Verify token must match `.env` → `META_WA_VERIFY_TOKEN` (default example: `catalpa_verify`). Set `SAMUEL_WHATSAPP` to your number (digits, Ghana format `233…`).

## 6. Paste webhook in WhatsApp → Configuration

In the Meta app → **WhatsApp** → **Configuration**:

- Callback URL = the URL from step 5  
- Verify token = same as `META_WA_VERIFY_TOKEN`  
- Verify and save  
- Subscribe to **messages**

Put the permanent access token and Phone number ID into `.env` (`META_WA_ACCESS_TOKEN`, `META_WA_PHONE_NUMBER_ID`). Restart the server.

## 7. Send one test message into the bot

From your phone (or Meta’s test panel), message the WhatsApp number linked in step 4/6. Send `hi`. You should get the Catalpa greet + offers. Complete: business type → city → `same` → yes/no → `1` (demo) or `2` (lead). Confirm the lead on:

`https://YOUR_HOST/dashboard.html?tenant=catalpa`

## 8. Move to a real WhatsApp Business number (when ready)

In WhatsApp Manager / Business settings, add Catalpa’s production phone number to the WhatsApp Business Account. Complete Meta’s checks. Point the same webhook at this number. Update `.env` Phone number ID if it changes.

## 9. Create the first CTWA campaign pointing at Catalpa WhatsApp

In Meta Ads Manager (same Business Manager):

1. Create campaign → objective **Engagement** (or Messages) → **Click to WhatsApp**  
2. Ad set: Ghana (start Accra/Kumasi), people interested in small business / online advertising  
3. Ad: use **Ad copy v1** below; creative notes below; destination = the Catalpa WhatsApp number from step 8 (or test number if still testing)  
4. Publish with a small daily budget  

People who click open WhatsApp already chatting with the Catalpa bot.

## 10. Measure leads in the Catalpa dashboard

Open `https://YOUR_HOST/dashboard.html?tenant=catalpa`. New conversations show under **Inbound leads**. Status: `new` / `demo_booked` / … Use **Notify Samuel (wa.me)** if you want a one-tap WhatsApp ping. Do not judge the ad on clicks alone — count **leads and demos booked** here.

---

## Ad copy v1

**Primary text**

> Ghana business owners: buyers already message you on WhatsApp from Facebook ads — but who answers at night?  
> Catalpa runs a 24/7 WhatsApp bot that greets them, takes the order or lead, and shows you everything on a simple dashboard.  
> See a live demo first. You pay only when it works for your shop.

**Headline**

> WhatsApp orders while you sleep

**CTA button**

> Send WhatsApp message

**Creative should show (≤1.3 min video later; for now stills or screen record)**

1. Phone screen: Facebook/Instagram ad → tap → WhatsApp opens to Catalpa  
2. Bot messages: greet + short qualify questions (business type, city)  
3. Owner phone: Catalpa dashboard with a new inbound lead / demo booked  
4. One line on screen: “Free live demo · pay when it works”  
5. End frame: Catalpa Automations + WhatsApp CTA  

No chop-bar food menu in this ad — this sell is Catalpa itself.
