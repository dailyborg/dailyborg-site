import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { readEnv } from '@/lib/admin-auth';

export const runtime = 'edge';

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MAX_EMAIL_LENGTH = 254;

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as any;
        const subscriberId = typeof body.subscriberId === 'string' ? body.subscriberId.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

        // Stripe needs a real address to send the receipt to, and it is how the webhook ties a completed
        // checkout back to a person. A subscriber id is optional: the page starts checkout before any
        // subscriber row exists, so the email itself is the reference when there is no id.
        if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
            return NextResponse.json({ error: "A valid email address is required for checkout." }, { status: 400 });
        }
        if (subscriberId.length > 64) {
            return NextResponse.json({ error: "Invalid subscriber reference." }, { status: 400 });
        }
        const clientReference = subscriberId || `email:${email}`;

        const stripeSecret = readEnv('STRIPE_SECRET_KEY');
        if (!stripeSecret) {
            return NextResponse.json({ error: "Premium checkout is not configured yet. Your free subscription is active." }, { status: 503 });
        }
        const stripe = new Stripe(stripeSecret);
        const baseUrl = readEnv('NEXT_PUBLIC_SITE_URL') || 'https://dailyborg.com';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email, // Pre-fill email so they don't have to type it again
            client_reference_id: clientReference, // subscriber id when known, otherwise "email:<address>"
            mode: 'subscription', // Since we don't have a pre-created price ID, we'll use inline price_data. For subscriptions, Stripe requires a saved Price ID or inline recurring prices.
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Premium Director Access',
                            description: 'Full articles delivered to your inbox every morning.',
                        },
                        unit_amount: 99, // $0.99
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/subscribe?success=true`,
            cancel_url: `${baseUrl}/subscribe?canceled=true`,
        });

        return NextResponse.json({ url: session.url }, { status: 200 });
    } catch (err: any) {
        console.error("Stripe Checkout Error:", err);
        return NextResponse.json({ error: "Checkout could not be started. Please try again." }, { status: 500 });
    }
}
