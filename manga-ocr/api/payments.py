import os
import stripe
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from db.database import get_db
from db import models
from api.deps import get_current_user

# Stripe key configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock")

router = APIRouter(prefix="/payments", tags=["payments"])

@router.get("/config")
def get_config():
    """Retrieve Stripe publishable key for frontend"""
    return {
        "publishableKey": os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    }

@router.post("/create-checkout-session")
def create_checkout_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create Stripe checkout session for recurring subscription"""
    try:
        # Create customer on stripe if not exists
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": current_user.id}
            )
            current_user.stripe_customer_id = customer.id
            db.commit()

        # Build Checkout Session with dynamic price data
        session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'eur',
                        'product_data': {
                            'name': 'SensAI Premium',
                            'description': 'Accès illimité aux analyses de bulles de texte, dossiers et fiches de révisions.',
                        },
                        'unit_amount': 999,  # 9.99 EUR
                        'recurring': {
                            'interval': 'month',
                        },
                    },
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url='http://localhost:5173/stats?checkout_success=true',
            cancel_url='http://localhost:5173/stats?checkout_cancel=true',
        )
        return {"url": session.url}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-portal-session")
def create_portal_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Redirect premium users to Stripe Customer Portal to manage subscription"""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Vous n'avez pas de compte client Stripe actif.")
    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url='http://localhost:5173/stats',
        )
        return {"url": session.url}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook to listen for async payment and subscription changes"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        customer_id = data_object.get("customer")
        subscription_id = data_object.get("subscription")
        
        user = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if user:
            user.is_premium = True
            user.subscription_id = subscription_id
            db.commit()
            print(f"🎉 User {user.email} is now Premium!")
            
    elif event_type == "customer.subscription.deleted":
        subscription_id = data_object.get("id")
        user = db.query(models.User).filter(models.User.subscription_id == subscription_id).first()
        if user:
            user.is_premium = False
            user.subscription_id = None
            db.commit()
            print(f"😢 User {user.email} is no longer Premium.")

    return {"status": "success"}
