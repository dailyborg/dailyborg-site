import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestContext } from '@cloudflare/next-on-pages';

export async function POST(request: Request) {
    try {
        const payload = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
        }

        const stripeSecret = process.env.STRIPE_SECRET_KEY || (process.env as any).STRIPE_SECRET_KEY_MOCK || 'sk_test_MockToken123xyz';
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || (process.env as any).STRIPE_WEBHOOK_SECRET_MOCK || 'whsec_MockWebhookSecret';

        const stripe = new Stripe(stripeSecret, {
            apiVersion: '2026-02-25.clover',
        });

        let event: Stripe.Event;

        try {
            // For true local dev without Stripe CLI, you might bypass signature verification
            if (webhookSecret === 'whsec_MockWebhookSecret') {
                event = JSON.parse(payload);
            } else {
                event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
            }
        } catch (err: any) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
        }

        // Handle the event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const subscriberId = session.client_reference_id;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;

            if (subscriberId) {
                console.log(`[Stripe Webhook] Upgrading subscriber ${subscriberId} to Premium Director.`);

                let db;
                try {
                    const context = getRequestContext();
                    db = (context.env as any).DB;
                } catch (e) {
                    console.warn("Running outside Cloudflare context. Falling back to local DB.");
                    const { getD1Database } = await import('../../../../lib/db');
                    db = await getD1Database();
                }

                if (db) {
                    await db.prepare(`
                        UPDATE subscribers 
                        SET plan_type = 'paid', 
                            stripe_customer_id = ?, 
                            stripe_subscription_id = ?, 
                            stripe_status = 'active',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(customerId || null, subscriptionId || null, subscriberId).run();
                    console.log(`[Stripe Webhook] Database update successful for ${subscriberId}.`);
                } else {
                    console.error("[Stripe Webhook] Could not bind to DB. Plan upgrade failed.");
                }
            } else {
                console.warn("[Stripe Webhook] checkout.session.completed fired, but no client_reference_id was attached.");
            }
        }

        if (event.type === 'customer.subscription.deleted') {
            // Handle cancellations
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            let db;
            try {
                const context = getRequestContext();
                db = (context.env as any).DB;
            } catch (e) {
                const { getD1Database } = await import('../../../../lib/db');
                db = await getD1Database();
            }

            if (db) {
                await db.prepare(`
                    UPDATE subscribers 
                    SET plan_type = 'free', 
                        stripe_status = 'canceled',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_customer_id = ?
                `).bind(customerId).run();
                console.log(`[Stripe Webhook] Downgraded canceled subscription for customer ${customerId}.`);
            }
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (err: any) {
        console.error("Stripe Webhook Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
