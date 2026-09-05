import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { readEnv } from '@/lib/admin-auth';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const body = await request.json() as any;
        const { subscriberId, email } = body;

        if (!subscriberId) {
            return NextResponse.json({ error: "Missing subscriber ID" }, { status: 400 });
        }

        const stripeSecret = readEnv('STRIPE_SECRET_KEY');
        if (!stripeSecret) {
            return NextResponse.json({ error: "Premium checkout is not configured yet. Your free subscription is active." }, { status: 503 });
        }
        const stripe = new Stripe(stripeSecret);
        const baseUrl = readEnv('NEXT_PUBLIC_SITE_URL') || 'https://dailyborg.com';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email, // Pre-fill email so they don't have to type it again
            client_reference_id: subscriberId, // Crucial connection back to our D1 database UUID
            mode: 'subscription', // Since we don't have a pre-created price ID, we'll use inline price_data. For subscriptions, Stripe requires a saved Price ID or inline recurring prices.
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Premium Director Access',
                            description: 'Full articles delivered securely to your inbox (Email / WhatsApp).',
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
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
