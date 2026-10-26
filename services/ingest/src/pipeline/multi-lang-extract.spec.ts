import { describe, expect, it } from 'vitest';
import { extractMultiLangSource } from './multi-lang-extract';
import { parseSource } from './parser';

describe('multi-lang-extract', () => {
  describe('Python parsing', () => {
    const pythonCode = `
import os
import sys
from fastapi import FastAPI, APIRouter
from pydantic import BaseModel
from typing import Optional

app = FastAPI()
router = APIRouter()

class UserProfile(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

@app.get("/users/{user_id}")
async def get_user_profile(user_id: int):
    """Retrieve user details by id."""
    return {"user_id": user_id}

@router.post("/checkout/charge")
def process_checkout():
    pass

def calculate_discount(price: float, rate: float = 0.1) -> float:
    return price * (1.0 - rate)
`;

    it('extracts imports, functions, models, and routes from Python', () => {
      const extracted = extractMultiLangSource('services/auth/api.py', pythonCode);
      expect(extracted).not.toBeNull();
      if (!extracted) return;

      expect(extracted.imports.map((i) => i.specifier)).toEqual(
        expect.arrayContaining(['os', 'sys', 'fastapi', 'pydantic', 'typing']),
      );

      const modelNames = extracted.models.map((m) => m.name);
      expect(modelNames).toContain('UserProfile');

      const funcNames = extracted.functions.map((f) => f.name);
      expect(funcNames).toContain('get_user_profile');
      expect(funcNames).toContain('process_checkout');
      expect(funcNames).toContain('calculate_discount');

      const routePaths = extracted.routes.map((r) => r.path);
      expect(routePaths).toContain('/users/{user_id}');
      expect(routePaths).toContain('/checkout/charge');
    });

    it('integrates seamlessly with parseSource', () => {
      const parsed = parseSource('app/main.py', pythonCode);
      expect(parsed).not.toBeNull();
      if (!parsed || 'root' in parsed) return;

      expect(parsed.models.some((m) => m.name === 'UserProfile')).toBe(true);
      expect(parsed.functions.some((f) => f.name === 'calculate_discount')).toBe(true);
      expect(parsed.routes.some((r) => r.path === '/users/{user_id}')).toBe(true);
    });
  });

  describe('Go parsing', () => {
    const goCode = `
package main

import (
	"fmt"
	"net/http"
	"github.com/gin-gonic/gin"
)

type SubscriptionTier struct {
	ID int \`json:"id"\`
	Name string \`json:"name"\`
	Price float64 \`json:"price"\`
}

func ProcessPayment(tier SubscriptionTier) (bool, error) {
	fmt.Println("processing payment")
	return true, nil
}

func RegisterRoutes(r *gin.Engine) {
	r.GET("/api/v1/subscriptions", func(c *gin.Context) {})
	r.POST("/api/v1/checkout", func(c *gin.Context) {})
}
`;

    it('extracts structs, functions, and gin routes from Go', () => {
      const extracted = extractMultiLangSource('cmd/server/main.go', goCode);
      expect(extracted).not.toBeNull();
      if (!extracted) return;

      expect(extracted.imports.map((i) => i.specifier)).toEqual(
        expect.arrayContaining(['fmt', 'net/http', 'github.com/gin-gonic/gin']),
      );

      const structNames = extracted.models.map((m) => m.name);
      expect(structNames).toContain('SubscriptionTier');

      const funcNames = extracted.functions.map((f) => f.name);
      expect(funcNames).toContain('ProcessPayment');
      expect(funcNames).toContain('RegisterRoutes');

      const routePaths = extracted.routes.map((r) => r.path);
      expect(routePaths).toContain('/api/v1/subscriptions');
      expect(routePaths).toContain('/api/v1/checkout');
    });
  });

  describe('Rust parsing', () => {
    const rustCode = `
use std::collections::HashMap;
use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct OrderInvoice {
    pub order_id: String,
    pub amount: f64,
}

#[get("/api/invoices/{id}")]
pub async fn get_invoice(id: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body("invoice")
}

#[post("/api/invoices")]
pub fn create_invoice() -> impl Responder {
    HttpResponse::Created().finish()
}

pub fn calculate_tax(amount: f64) -> f64 {
    amount * 0.16
}
`;

    it('extracts structs, functions, and actix routes from Rust', () => {
      const extracted = extractMultiLangSource('src/handlers/invoice.rs', rustCode);
      expect(extracted).not.toBeNull();
      if (!extracted) return;

      expect(extracted.imports.map((i) => i.specifier)).toEqual(
        expect.arrayContaining(['std::collections::HashMap', 'actix_web', 'serde']),
      );

      const structNames = extracted.models.map((m) => m.name);
      expect(structNames).toContain('OrderInvoice');

      const funcNames = extracted.functions.map((f) => f.name);
      expect(funcNames).toContain('get_invoice');
      expect(funcNames).toContain('create_invoice');
      expect(funcNames).toContain('calculate_tax');

      const routePaths = extracted.routes.map((r) => r.path);
      expect(routePaths).toContain('/api/invoices/{id}');
      expect(routePaths).toContain('/api/invoices');
    });
  });
});
