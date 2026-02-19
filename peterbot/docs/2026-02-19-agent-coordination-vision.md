# Agent Coordination: A Vision for Post-SaaS Collaboration

> A thought experiment on how personal AI agents might replace SaaS applications through decentralized coordination protocols.

## The Problem

SaaS applications lock users in by controlling the data layer. If personal AI agents are to "kill SaaS," they need a way to coordinate on shared state—bookings, documents, projects—without ceding control to a single platform.

This document explores an architecture for agent-to-agent collaboration across trust boundaries.

---

## Core Insight: Agents Replace UI, Not Infrastructure

The conference room still has a database. The calendar still stores events. But instead of you logging into Outlook and clicking buttons, **your agent negotiates with the room's agent**.

SaaS becomes invisible infrastructure. The interface is conversation—between you and your agent, between agents themselves.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT LAYER                              │
│  (Your agent ↔ Room agent ↔ Partner agent ↔ Public agent)   │
│                                                              │
│  Protocol: Discovery → Handshake → Negotiation → Settlement │
│  Data: Minimized by default, org registry for full sharing  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐           ┌─────────┐
   │  Tier 1 │          │  Tier 2 │           │  Tier 3 │
   │Same Org │          │ Partners│           │ Public  │
   │         │          │         │           │         │
   │Signatures│         │B2B Chain│           │Sui/etc  │
   │  (free)  │         │(fast, auditable)    │(spam-resistant)
   └─────────┘          └─────────┘           └─────────┘
```

---

## The Protocol Stack

### 1. Discovery (Hybrid Model)

Agents find each other through a combination of:

- **Well-known directory** (like DNS): `room-booking.office.corp` resolves to the room agent's DID
- **Gossip/referrals**: Agents learn about other agents through trusted introductions
- **Capability advertisements**: Agents broadcast what they can do, not just who they are

```json
{
  "agent": "room-booking-agent@office.corp",
  "did": "did:web:office.corp#room-agent",
  "capabilities": ["check_availability", "book_room", "cancel_booking"],
  "protocol": "reservation/v1",
  "trust_tier": "tier1"
}
```

### 2. Handshake (Trust Establishment)

Before sharing data, agents establish trust boundaries:

- **Same organization**: Automatic trust via org registry
- **Partner organizations**: Mutual registry entry, B2B chain for audit trail
- **Public/unowned**: No handshake needed, economic stake replaces trust

The handshake registry unlocks SaaS-level data sharing. Teammates see full meeting titles. Partners see coordination data only. Public resources see minimal required information.

### 3. Negotiation (Structured + Natural)

Agents communicate in a protocol that bridges structured efficiency and human flexibility:

**Structured layer (for clear cases):**
```json
{
  "intent": "book_room",
  "resource": "conference_room_a",
  "time": "2024-03-20T14:00:00Z",
  "duration": "1h",
  "requester": "did:web:user.com",
  "data_minimization": true
}
```

**Confirmation loop (for validation):**
```json
{
  "status": "needs_clarification",
  "interpretation": "Book Conference Room A from 2:00 PM to 3:00 PM today",
  "confirm": true,
  "alternatives": ["2:00-4:00?", "Conference Room B at 2:00?"]
}
```

**Natural language fallback (for edge cases):**
> "Actually I need the room from 2pm but I can move if Sarah needs it more"

### 4. Settlement (Trust-Tier Based)

The attestation layer depends on the trust relationship:

| Tier | Use Case | Settlement Method | Properties |
|------|----------|-------------------|------------|
| Tier 1 | Same organization | Cryptographic signatures | Free, instant, private |
| Tier 2 | Partner organizations | Shared B2B coordination chain | Fast, auditable, no vendor lock-in |
| Tier 3 | Public/unowned resources | Fast public chain (Sui, etc.) | Spam-resistant, global consensus |

---

## Data Minimization by Design

Privacy is not a policy—it's a protocol feature:

- **Coordination data only**: Time slots, resource IDs, availability
- **Content remains private**: Meeting topics, attendee lists, attached documents
- **Progressive disclosure**: Handshake registry unlocks deeper sharing
- **User control**: You define what your agent reveals per interaction type

Example:
- Your agent to room agent: "Book Conference Room A, 2-3pm"
- Your agent to teammate's agent (same org): "Book Conference Room A, 2-3pm for Q2 planning with full attendee list"
- Your agent to partner's agent: "Request coordination for 2-3pm slot, confirm availability"

---

## The User Experience

**You:** "Book me a room at 2pm with Sarah from Acme Corp"

**Behind the scenes:**
1. Your agent discovers the room agent via directory
2. Checks org registry: Acme is a trusted partner (Tier 2)
3. Negotiates with room agent for availability
4. Negotiates with Acme's agent for Sarah's calendar
5. Confirms booking with both parties
6. Settles on B2B coordination chain for audit trail
7. Returns: "Done. Conference Room A, 2-3pm. Sarah confirmed. Booking attestation: 0x7a3f..."

**No login. No tabs. No SaaS interface. Just results.**

---

## The Registry Service

For this vision to work, agents need a neutral place to register, discover each other, and establish trust. This section describes the **platform layer**—a hosted service that implements the open protocol.

### Business Model: Open Protocol + Hosted Service

**The protocol is open.** Anyone can run their own registry, build their own discovery server, settle attestations on their own chain. No vendor lock-in.

**The hosted service is convenient.** Most developers pay for the managed version because it's easier, faster, and comes with trust guarantees.

**Revenue model:**
- **Free tier**: Personal projects, up to 3 agents, public registry only
- **Developer tier**: Unlimited agents, private handshakes, B2B chain settlement (pay per usage)
- **Commercial tier**: Revenue share (e.g., 5%) when developers charge end users for agent services

**Why developers pay:**
1. **Don't build it themselves** - Discovery, handshake verification, settlement infrastructure
2. **Trust signal** - "Verified by [Platform]" badge that end users demand
3. **Network effects** - Agents on the platform can talk to each other
4. **Payment rails** - Built-in billing, dispute resolution, insurance

### Platform Positioning: First and Neutral

**First-mover advantage:** Become the default registry before big players (OpenAI, Google) build their own. Embed into Claude, Cursor, and other agent platforms as the "official" discovery skill/MCP.

**Neutrality as moat:** Not owned by an AI company. Not owned by a SaaS vendor. A neutral Switzerland that all parties can trust.

**The bet:** Being first + being neutral = becoming the dial tone for agent coordination.

### Architecture Overview

**What the platform provides:**

| Component | Function | Developer pays for |
|-----------|----------|------------------|
| **Identity Registry** | DID → endpoint + capabilities mapping | Registration, lookups |
| **Discovery Service** | Find agents by capability, org, location | Queries |
| **Handshake Broker** | Establish trust between orgs | Handshake creation, verification |
| **B2B Settlement Chain** | Shared ledger for Tier 2 attestations | Transaction fees |
| **Reputation System** | Ratings, dispute resolution, insurance | Verification badges |
| **Payment Rails** | Billing, revenue share, payouts | Percentage of revenue |

**What developers bring:**
- Their own agents (deployed anywhere)
- Their own databases (bookings, state, user data)
- Their own business logic

**What end users see:**
- Nothing. They talk to their agent. The registry is invisible infrastructure.

### Dashboard Experience

Developers log into a Stripe-like dashboard:

1. **My Agents** - List of registered agents, their DIDs, endpoints, capabilities
2. **Connections** - Trusted orgs, pending handshakes, revoked access
3. **Discovery Analytics** - How many times their agents were found, negotiated with, rated
4. **Settlement History** - Attestations settled, disputes, insurance claims
5. **Revenue** - If commercial: earnings, payouts, platform fees

### Integration: The MCP/Skill Angle

The registry exposes an MCP (Model Context Protocol) server or skill that AI platforms can integrate:

```
User: "Book me a room at 2pm"
Claude: Uses MCP skill → queries registry for room-booking agents near user
       → finds verified agent, checks handshake
       → negotiates booking
       → returns result
```

If Claude, Cursor, and other platforms ship with this skill pre-installed, the registry becomes the default coordination layer.

### Risk: The "Email Problem"

Email succeeded because SMTP is open. But nobody owns email. The protocol created massive value, but no single company captured it.

**Mitigation:**
- Revenue from convenience, not lock-in
- Commercial tier creates ongoing value (payment processing, dispute resolution)
- Enterprise features (SLAs, compliance, insurance) for those who need them
- Neutral positioning makes the platform defensible against big tech

---

## Open Questions

1. **Who runs the B2B coordination chain?** A consortium? A decentralized network? A protocol that any chain can implement?

2. **What does the directory look like?** Is it DNS-like? A blockchain name service? Federated servers?

3. **How do we prevent agent spam?** Economic stake works for Tier 3. Reputation systems for Tier 2? Rate limiting by handshake?

4. **What about legacy SaaS?** Do agents wrap existing APIs? Or does this only work for "agent-native" services?

5. **Conflict resolution**: Two agents book the same room simultaneously. Tier 1: central authority decides. Tier 3: chain finality decides. Tier 2: ???

6. **Chicken-and-egg problem**: How do we get developers before there are users, and users before there are agents?

---

## Relation to Peterbot

This is not a roadmap item. It is a thinking exercise—exploring what a world of ubiquitous agents might look like, and whether the coordination protocols we build today might evolve into something like this.

Peterbot is a single-user agent. The next evolution is multi-user. The evolution after that is multi-agent—where your agent collaborates with mine, with room agents, with service agents, without any of us logging into a SaaS platform.

---

*Written: 2026-02-19*  
*Status: Vision / Future thinking*  
*Not a commitment to implement*
