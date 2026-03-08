import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getD1Database } from "@/lib/db";

export const runtime = "edge";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
    apiVersion: "2025-02-24.acacia" as any,
});

export async function POST(req: NextRequest) {
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        const bodyText = await req.text();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock";

        // Construct the event, verifying the signature to prevent malicious requests
        event = await stripe.webhooks.constructEventAsync(
            bodyText,
            signature,
            webhookSecret
        );
    } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the specific event we care about: a completed checkout
    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        // This is the UUID we injected during the /api/stripe/checkout step
        const subscriberId = session.client_reference_id;

        if (subscriberId) {
            console.log(`[STRIPE WEBHOOK] Successful payment for subscriber: ${subscriberId}`);
            try {
                const db = await getD1Database();
                if (!db) throw new Error("Could not find local DB bypass mock");

                // Upgrade their account instantly
                const updateRes = await db.prepare(`
                    UPDATE subscribers 
                    SET plan_type = 'paid',
                        stripe_customer_id = ?,
                        stripe_subscription_id = ?
                    WHERE id = ?
                `).bind(
                    session.customer as string || null,
                    session.subscription as string || null,
                    subscriberId
                ).run();

                if (!updateRes.success) {
                    console.error("[STRIPE WEBHOOK] D1 Update Warning. Account may not be upgraded.");
                } else {
                    console.log(`[STRIPE WEBHOOK] Upgraded ${subscriberId} to Premium Director.`);
                }
            } catch {
                console.error("[STRIPE WEBHOOK] D1 DB Error: Account may not be upgraded.");
                // We return 200 anyway so Stripe stops retrying the webhook
                // In a real app we'd queue this for a retry
            }
        }
    }

    return NextResponse.json({ received: true });
}
