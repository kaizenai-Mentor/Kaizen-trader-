# AI provider continuity and alerts

KAIZEN tries configured providers in order: Anthropic Claude, Google Gemini, then OpenRouter. Every new request starts at the top of the list. Failover is triggered by a failed request, not by monitoring credit balances. Failures can also be caused by rate limits, network problems, invalid keys, model availability, or provider outages. Each attempt can incur charges according to provider terms.

Session reviews stream as the provider writes. If a stream fails or ends without a completion signal, the failed response and its extraction tail are discarded, the next configured provider starts immediately, and the browser erases the visible partial response before displaying the replacement. Reduced-motion settings skip the animation. Only the successful provider's response is saved. If no provider succeeds, the saved session review is explicitly labeled as a limited automated response; it is not a full AI review. Other chat surfaces still stream and cannot automatically switch after text has already been displayed.

## Owner warning setup

In Render service environment settings, set `AI_ALERT_EMAIL` to the owner's alert inbox, `RESEND_API_KEY` to a valid Resend API key, and `RESEND_FROM` to an address that Resend allows the account to send from. Save and redeploy if required by Render. Use the corresponding settings in local `.env` for Termux. Do not commit or share API keys. Without these settings, failures appear only in server logs.

On an AI provider request failure, the application logs the provider and a coarse error category and attempts to email the owner without including prompts, responses, API keys, or account details. The email is best effort: delivery is not guaranteed. Sending is throttled to once per provider per hour **per server process**; restarts or multiple instances can result in additional alerts. A failed email can be retried on a later provider failure. Alerts are reactive and do not detect low credit before a request fails. Use the providers' own billing dashboards and alerts to monitor balances and spending.

## Privacy and deployment checks

Confirm the live Gemini billing tier and the OpenRouter model, billing and privacy settings before using them for real trader information. OpenRouter routes to another model provider; its data policies depend on the selected model, endpoint and account settings. Google's unpaid Gemini terms warn against submitting personal, sensitive or confidential information. Verify applicable terms and update the privacy notice, including any fallbacks, before relying on these services. Do not assume a fallback has the same quality, privacy settings, availability or charges as Claude.

## Deferred feature: image transcription and analysis

Owner decision: plan only, not implemented. Wait for the owner to top up the providers and give explicit approval before building. The earlier concept is to let traders submit setup images for an editable draft and confirmation, and separately review session charts alongside confirmed rules and session notes. Include clear notice of actual recipients and image handling, allow removing each chosen image, and avoid overstating what the image shows. Existing session review does not send stored session screenshots to the AI. Existing KAIZEN AI chat can send a newly attached image to a configured provider; this deferred work does not enable or change that existing behavior.
