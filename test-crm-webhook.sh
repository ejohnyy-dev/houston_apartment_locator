#!/bin/bash

# Test CRM Webhook Integration
# Tests that form submissions forward to the CRM with retry logic

set -e

CRM_URL="https://innocent-terrace-rides-superior.trycloudflare.com/api/leads"
TEST_EMAIL="test-$(date +%s)@txaptfinder.test"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing CRM Webhook Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Direct CRM endpoint (no retry)
echo "Test 1: Direct POST to CRM /api/leads"
echo "URL: $CRM_URL"
echo "Payload:"
cat << EOF
{
  "firstName": "Test User",
  "lastName": "Suite",
  "email": "$TEST_EMAIL",
  "phone": "+17135551234",
  "bedrooms": 2,
  "priceMin": 1500,
  "priceMax": 2000,
  "moveInDate": "2026-07-01",
  "preferredArea": "Heights",
  "source": "test",
  "smsConsent": true
}
EOF
echo ""

RESPONSE=$(curl -s -X POST "$CRM_URL" \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "firstName": "Test User",
  "lastName": "Suite",
  "email": "$TEST_EMAIL",
  "phone": "+17135551234",
  "bedrooms": 2,
  "priceMin": 1500,
  "priceMax": 2000,
  "moveInDate": "2026-07-01",
  "preferredArea": "Heights",
  "source": "test",
  "smsConsent": true
}
EOF
)

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if lead was created/updated
if echo "$RESPONSE" | grep -q '"leadId"'; then
  LEAD_ID=$(echo "$RESPONSE" | jq '.leadId' 2>/dev/null)
  echo "✅ Success! Lead created/updated: #$LEAD_ID"
  echo "   Email: $TEST_EMAIL"
else
  echo "⚠️  Response received but no leadId in response"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Form submission (via local server)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Start the server with: npm run dev"
echo "Then curl to: http://localhost:3000/api/leads"
echo ""
echo "Test script available at:"
echo "  cd ~/projects/houston_apartment_locator"
echo "  bash test-crm-webhook.sh"
