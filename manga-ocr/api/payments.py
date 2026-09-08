import os
import stripe
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
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

class CheckoutSessionRequest(BaseModel):
    origin: Optional[str] = None
    return_path: Optional[str] = None

@router.post("/create-checkout-session")
def create_checkout_session(
    request: Request,
    req: Optional[CheckoutSessionRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create Stripe checkout session for recurring subscription with dynamic origin"""
    try:
        # Résoudre l'URL de base du frontend de façon dynamique
        frontend_origin = None
        if req and req.origin:
            frontend_origin = req.origin.rstrip('/')
        elif request.headers.get("origin"):
            frontend_origin = request.headers.get("origin").rstrip('/')
        elif request.headers.get("referer"):
            from urllib.parse import urlparse
            p = urlparse(request.headers.get("referer"))
            frontend_origin = f"{p.scheme}://{p.netloc}"
        
        if not frontend_origin:
            frontend_origin = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')

        return_path = (req.return_path if (req and req.return_path) else "/stats")
        if not return_path.startswith('/'):
            return_path = '/' + return_path

        # Create customer on stripe if not exists
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": str(current_user.id)}
            )
            current_user.stripe_customer_id = customer.id
            db.commit()

        # Build Checkout Session with dynamic price data and client_reference_id
        session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            client_reference_id=str(current_user.id),
            metadata={"user_id": str(current_user.id)},
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
            success_url=f'{frontend_origin}{return_path}?checkout_success=true&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_origin}{return_path}?checkout_cancel=true',
        )
        return {"url": session.url}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-portal-session")
def create_portal_session(
    request: Request,
    req: Optional[CheckoutSessionRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Redirect premium users to Stripe Customer Portal to manage subscription"""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Vous n'avez pas de compte client Stripe actif.")
    try:
        frontend_origin = None
        if req and req.origin:
            frontend_origin = req.origin.rstrip('/')
        elif request.headers.get("origin"):
            frontend_origin = request.headers.get("origin").rstrip('/')
        elif request.headers.get("referer"):
            from urllib.parse import urlparse
            p = urlparse(request.headers.get("referer"))
            frontend_origin = f"{p.scheme}://{p.netloc}"
        if not frontend_origin:
            frontend_origin = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip('/')

        return_path = (req.return_path if (req and req.return_path) else "/profile")
        if not return_path.startswith('/'):
            return_path = '/' + return_path

        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f'{frontend_origin}{return_path}',
        )
        return {"url": session.url}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

class SyncSubscriptionRequest(BaseModel):
    session_id: str

@router.post("/sync-subscription")
def sync_subscription(
    req: SyncSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Synchronously verify and activate premium subscription on return redirect.
    Supporte l'authentification explicite et par repli Stripe metadata/customer.
    """
    try:
        user = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                from jose import jwt
                from core.security import SECRET_KEY, ALGORITHM
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                email = payload.get("sub")
                if email:
                    user = db.query(models.User).filter(models.User.email == email).first()
            except Exception:
                pass

        session = stripe.checkout.Session.retrieve(req.session_id)
        
        # Si utilisateur non identifié par token, résolution via Stripe Session
        if not user:
            if session.client_reference_id:
                try:
                    user = db.query(models.User).filter(models.User.id == int(session.client_reference_id)).first()
                except Exception:
                    pass
            if not user and session.customer:
                user = db.query(models.User).filter(models.User.stripe_customer_id == session.customer).first()
            if not user and session.customer_details and session.customer_details.email:
                user = db.query(models.User).filter(models.User.email == session.customer_details.email).first()

        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur associé à la session Stripe introuvable.")

        if session.payment_status == "paid" or session.subscription:
            user.is_premium = True
            user.subscription_id = session.subscription
            if session.customer:
                user.stripe_customer_id = session.customer
            db.commit()
            db.refresh(user)

            from core.security import create_access_token
            access_token = create_access_token(data={"sub": user.email})

            return {
                "status": "success",
                "is_premium": user.is_premium,
                "access_token": access_token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "is_premium": user.is_premium
                }
            }
        else:
            return {"status": "unpaid", "is_premium": user.is_premium}
    except HTTPException:
        raise
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
