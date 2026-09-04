# Liminal Backend: PRD

## Product Overview

Liminal Interior Design Studio is a comprehensive **interior design and furniture commerce platform** built to showcase design work, manage interior design and custom furniture inquiries and operate a ready-made furniture e-commerce store through a secure, scalable and maintainable backend.

## Business Context

Liminal Interior Design Studio operates across three connected business lines, all supported by a unified backend system:

- **Interior Design Services** covering residential and commercial projects, project showcases and structured client inquiries
- **Custom Furniture Design** with a dedicated inquiry process for capturing client requirements, design preferences and specifications
- **Ready-Made Furniture Retail** with a complete e-commerce flow covering product catalog, cart, checkout, payment and order management

Supporting business needs across these lines include:

- **Project and content management** for showcasing design work, sharing industry insights, building trust and supporting SEO
- **Inquiry management** for capturing, tracking and managing interior design and custom furniture leads throughout their lifecycle
- **Secure customer accounts** with profile management, order history and inquiry status tracking
- **Role-based administration** for managing projects, furniture, content, inquiries, orders and customers based on assigned permissions
- **Secure order and payment processing** for reliable furniture purchasing and transaction management
- **Audit-friendly data management** with traceable records and historical information
- **Scalable infrastructure** capable of supporting future services, integrations and business capabilities

## Technical Scope

This project delivers a **production-grade RESTful API** that provides:

- Multi-role authentication and authorization for Super Admin, Admin and Customer
- Project portfolio and showcase management
- Interior design inquiry capture and lifecycle management
- Custom furniture inquiry capture and lifecycle management
- Furniture catalog, shopping cart, checkout and order lifecycle management
- Payment processing for furniture orders
- Blog content management
- Contact message and studio location management
- Caching and performance optimization
- Audit trails for critical business operations

---

## 🏗️ System Architecture Overview

### Technology Stack

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| **Runtime** | Node.js | 24.x LTS | JavaScript runtime environment |
| **Framework** | Express.js | 5.x | REST API framework |
| **Language** | TypeScript | 6.x | Type-safe development |
| **Database** | PostgreSQL | 16.x | Primary data store |
| **ORM** | Prisma | 7.x | Database access layer |
| **Cache** | Redis | Current stable | Caching and performance optimization |
| **Authentication** | Better Auth | Current stable | Authentication and session management |
| **Payment Gateway** | Stripe | Current stable | Payment processing for furniture orders |
| **Media Storage** | Cloudinary | Current stable | Project, product and blog media storage |
| **Email Service** | Nodemailer (SMTP) | Current stable | Transactional and notification emails |
| **Logging** | Winston | Current stable | Application logging |
| **Validation** | Zod | Current stable | Request and data validation |
| **Testing** | Jest | Current stable | Unit and integration testing |

> **Integration Assumption:** Stripe and Cloudinary are the current payment and media providers. Payment and media operations should remain behind dedicated service boundaries so these providers can be replaced later without requiring major changes to the core business logic.
> 

## System Characteristics

- **Architecture Pattern:** Layered Architecture with Controller, Service and Repository layers
- **API Design:** RESTful API with JSON payloads
- **Authentication:** Better Auth for authentication and session management
- **Data Model:** Relational PostgreSQL database with soft-delete support
- **Caching:** Redis for frequently accessed and read-heavy data
- **File Storage:** Cloudinary for project, product and blog media
- **Payment Processing:** Stripe for furniture order payments
- **Deployment:** Cloud-ready and containerizable

## Project Stakeholders

### User Roles

1. **Super Admin:** Has full system access, including management of administrator accounts, role assignments, system settings, content and business data.
2. **Admin:** Manages assigned business operations such as projects, inquiries, products, orders and blog content. Cannot create, remove, suspend or modify administrator accounts or their roles.
3. **Customer:** Can register and log in, manage their profile, submit inquiries, browse and purchase furniture and track their orders and inquiry status.

### External Integrations

- **Stripe** - Payment processing for furniture orders
- **Cloudinary** - Media storage for project, product and blog media
- **Email Service (SMTP)** - Registration, inquiry, order and notification emails

---

## 📑 STEP 2: FUNCTIONAL REQUIREMENTS (FR)

---

## 2.1 Authentication & Authorization Module

> **Authentication Provider:** Authentication and session management are handled by **Better Auth**. Better Auth is responsible for core authentication mechanisms, credential management, session lifecycle, email verification and Google authentication. The functional requirements below define Liminal's required authentication behavior, security rules and authorization policies without reimplementing Better Auth internals.
> 

### FR-AUTH-001: Email & Password Registration

**Priority**: CRITICAL

**User Story**: As a new visitor, I want to register with my email and password so that I can submit inquiries, track orders and manage my account.

**Requirements**:

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-001.1 | System must support email/password registration through Better Auth | - Valid email and password are required 
- Email format must be validated
- Password must satisfy the password policy |
| FR-AUTH-001.2 | System must reject duplicate email registration | - Duplicate email → HTTP 409 Conflict
- Email comparison is case-insensitive |
| FR-AUTH-001.3 | Passwords must never be stored or logged in plain text | - Password hashing and credential management are handled securely by Better Auth |
| FR-AUTH-001.4 | Public registrations must default to the `CUSTOMER` role | - New public registrations are always assigned `CUSTOMER`
- Users cannot select or modify their role during registration |
| FR-AUTH-001.5 | Public registration must never create a privileged account | - Registration cannot create or assign `ADMIN` or `SUPER_ADMIN` roles |
| FR-AUTH-001.6 | User and required authentication data must be created consistently | - User and related authentication data are created atomically and remain consistent |

**Input Validation Rules**:

```tsx
{
  email: string (valid email format, max 255 chars),
  password: string (min 8, max 100 chars),
  name: string (min 2, max 100 chars),
  contactNumber: string (optional, valid phone format),
  address: string (optional, max 500 chars)
}
```

**Success Response**: HTTP 201 Created

```json
{
  "success": true,
  "message": "Account created successfully. Please verify your email.",
  "data": {
    "id": "uuid",
    "email": "customer@example.com",
    "role": "CUSTOMER",
    "emailVerified": false
  }
}
```

**Error Scenarios**:

- Invalid email format → HTTP 400 Bad Request
- Duplicate email → HTTP 409 Conflict
- Weak/invalid password → HTTP 400 Bad Request
- Missing required fields → HTTP 400 Bad Request

---

### FR-AUTH-002: Google OAuth Sign-In / Sign-Up

**Priority**: HIGH

**User Story**: As a visitor, I want to continue with Google so that I can register or log in without creating a separate application password.

**Requirements**:

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-002.1 | System must support Google OAuth authentication through Better Auth | - Users can select “Continue with Google”
- OAuth flow is securely handled by Better Auth |
| FR-AUTH-002.2 | First-time Google authentication must create a Customer account | - New public Google users are assigned `CUSTOMER` role
- Name and profile image may be populated from the Google profile |
| FR-AUTH-002.3 | Verified Google identities may be treated as email-verified | - Google accounts with a verified email identity can access features requiring email verification without an additional verification email |
| FR-AUTH-002.4 | System must prevent unintended duplicate accounts when Google authentication matches an existing account | - Existing accounts are not duplicated unintentionally
- Account linking follows the configured Better Auth account-linking policy |
| FR-AUTH-002.5 | Google authentication must never grant or modify privileged roles | - Existing `ADMIN` or `SUPER_ADMIN` roles remain unchanged
- Public Google registration cannot create or assign a privileged role |

**Error Scenarios**:

- Google OAuth denied or cancelled → Authentication flow terminates safely
- Invalid OAuth response → HTTP 401 Unauthorized
- Authentication/provider failure → Appropriate authentication error
- Account linking conflict → HTTP 409 Conflict

---

### FR-AUTH-003: Account Linking & Unlinking

**Priority**: MEDIUM

**User Story:** As an authenticated user, I want to link or unlink my Google account so that I can choose how I authenticate.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-003.1 | System must allow an authenticated user to link a Google account | - Google account can be linked only to the currently authenticated user's account
- Linking requires successful Google authentication |
| FR-AUTH-003.2 | System must prevent unauthorized account linking | - Linking requires a valid authenticated session
- A Google account already linked to another user cannot be linked again |
| FR-AUTH-003.3 | System must allow users to unlink a linked Google account | - Google authentication can be removed when another valid authentication method remains |
| FR-AUTH-003.4 | System must prevent removal of the user's only authentication method | - Attempt to unlink the sole authentication method → HTTP 422 Unprocessable Entity |
| FR-AUTH-003.5 | Sensitive authentication changes must require appropriate authentication assurance | - Recent authentication or re-authentication is required where configured by the security policy |
| FR-AUTH-003.6 | Account linking or unlinking must not modify the user's application role | - Existing `CUSTOMER`, `ADMIN` or `SUPER_ADMIN` role remains unchanged |

### FR-AUTH-004: Email Verification

**Priority**: HIGH

**User Story:** As a registered email/password user, I want to verify my email address so that I can access features that require a verified email.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-004.1 | System must send a verification email after successful email/password registration | - Verification email is sent through the configured Better Auth email verification flow |
| FR-AUTH-004.2 | System must securely validate email verification requests | - Verification link is time-limited and single-use
- Invalid or expired verification links are rejected |
| FR-AUTH-004.3 | Successful verification must update the user's verification state | - `emailVerified` becomes `true` |
| FR-AUTH-004.4 | System must allow users to resend verification emails | - Resend requests are rate-limited to prevent abuse |
| FR-AUTH-004.5 | Verified Google identities may be treated as email-verified | - Google accounts with a trusted verified email identity do not require an additional verification email |

**Business Rules:**

- Email verification is required before placing a furniture order.
- Browsing, cart usage and inquiry submission do not require email verification.

**Error Scenarios:**

- Expired verification link → HTTP 400 Bad Request
- Invalid verification link → HTTP 400 Bad Request
- Already-used verification link → HTTP 400 Bad Request
- Verification rate limit exceeded → HTTP 429 Too Many Requests

---

### FR-AUTH-005: Login

**Priority**: CRITICAL

**User Story:** As a returning user, I want to log in using either my email/password or Google so that I can securely access my account.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-005.1 | System must support email/password login | - Valid email/password credentials establish an authenticated Better Auth session
- Invalid credentials are rejected |
| FR-AUTH-005.2 | System must support Google login | - Users with a linked Google authentication method can authenticate through Google |
| FR-AUTH-005.3 | System must reject suspended or deleted accounts | - Suspended or deleted accounts cannot establish an authenticated session |
| FR-AUTH-005.4 | System must rate-limit repeated failed authentication attempts | - Excessive failed attempts are temporarily restricted |
| FR-AUTH-005.5 | Successful authentication must establish a secure session | - Session is created and managed by Better Auth |

**Success Response:** HTTP 200 OK

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "customer@example.com",
      "role": "CUSTOMER",
      "emailVerified": true
    }
  }
}
```

> **Session Security:** The authenticated session is maintained through a secure, `httpOnly` cookie and is not exposed as an access or refresh token in the JSON response.
> 

**Error Scenarios:**

- Invalid email or password → HTTP 401 Unauthorized
- Suspended account → HTTP 403 Forbidden
- Deleted account → HTTP 403 Forbidden
- Authentication rate limit exceeded → HTTP 429 Too Many Requests

---

### FR-AUTH-006: Password Reset

**Priority**: HIGH

**User Story:** As a user who forgot my password, I want to reset it through email so that I can regain access to my account.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-006.1 | System must support password reset through Better Auth | - Password reset can be initiated using the registered email address |
| FR-AUTH-006.2 | System must send a secure password reset link | - Reset link is time-limited and single-use
- Reset link can only be used to reset the associated account's password |
| FR-AUTH-006.3 | System must prevent user enumeration | - Registered and unregistered email addresses receive the same generic reset response
- Response does not reveal whether the supplied email exists |
| FR-AUTH-006.4 | Password reset must securely update the user's password | - Password and credential management are handled securely by Better Auth |
| FR-AUTH-006.5 | Successful password reset must invalidate existing sessions | - All existing sessions are invalidated
- Previously active sessions require re-authentication |
| FR-AUTH-006.6 | Google-only accounts must not be forced through password reset | - Users without a configured password credential are directed to authenticate through Google
- Password reset is available if a password credential has been configured |
| FR-AUTH-006.7 | Password reset requests must be rate-limited | - Excessive reset requests are temporarily restricted to prevent abuse |

**Error Scenarios:**

- Expired or invalid reset link → HTTP 400 Bad Request
- Weak or invalid new password → HTTP 400 Bad Request
- Password reset rate limit exceeded → HTTP 429 Too Many Requests

---

### FR-AUTH-007: Change or Set Password

**Priority**: MEDIUM

**User Story:** As an authenticated user, I want to change or set a password so that I can securely manage my authentication methods.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-007.1 | Users with an existing password credential must confirm their current password before changing it | - Incorrect current password → HTTP 400 Bad Request |
| FR-AUTH-007.2 | System must enforce the configured password policy | - New password must satisfy the configured password requirements |
| FR-AUTH-007.3 | Users without a password credential may set an application password | - Google-only users can add a password through the supported Better Auth flow |
| FR-AUTH-007.4 | Adding or changing a password must not remove other authentication methods | - Existing Google authentication remains linked and available |
| FR-AUTH-007.5 | Password changes must follow the configured session security policy | - Existing sessions are handled according to the configured security policy |

**Error Scenarios:**

- Incorrect current password → HTTP 400 Bad Request
- Weak or invalid new password → HTTP 400 Bad Request
- Password change is not permitted for the current authentication state → HTTP 403 Forbidden

---

### FR-AUTH-008: Logout & Session Revocation

**Priority**: MEDIUM

**User Story:** As a logged-in user, I want to log out securely so that my active session can no longer be used.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-008.1 | System must invalidate the current session on logout | - The current session is revoked and can no longer be used for authenticated requests |
| FR-AUTH-008.2 | System must support logout from all devices | - All active sessions belonging to the user, including the current session, are revoked |
| FR-AUTH-008.3 | Revoked sessions must no longer authorize protected requests | - Subsequent requests using a revoked session → HTTP 401 Unauthorized |

### FR-AUTH-009: Session Management

**Priority**: HIGH

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-AUTH-009.1 | System must use session-based authentication | - Authenticated sessions are maintained through secure cookies |
| FR-AUTH-009.2 | Session lifecycle must be managed by Better Auth | - Session creation, validation, expiration, renewal and revocation follow the configured Better Auth policies |
| FR-AUTH-009.3 | Session cookies must use appropriate security attributes | - Cookies use `httpOnly`
-  `Secure` is enabled in production
- An appropriate `SameSite` policy is configured |
| FR-AUTH-009.4 | Session expiration and renewal behavior must be configurable | - Session lifetime and renewal behavior can be adjusted according to security requirements |
| FR-AUTH-009.5 | State-changing requests using cookie-based authentication must be protected against CSRF attacks | - Appropriate CSRF protection is applied to state-changing requests |

## 2.2 Role-Based Access Control (RBAC)

> **Authorization Model:** Authorization is enforced at the application level through a role-based access control (RBAC) model built on top of Better Auth's session management. The system defines three roles: `SUPER_ADMIN`, `ADMIN` and `CUSTOMER`. The functional requirements below define role permissions, administrative hierarchy, resource ownership and account-level access rules.
> 

### FR-RBAC-001: User Role System

**Priority**: CRITICAL

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-001.1 | System must define the supported user roles | - `SUPER_ADMIN`, `ADMIN` and `CUSTOMER` are the supported application roles |
| FR-RBAC-001.2 | Public registrations must always receive the `CUSTOMER` role | - Applies to both email/password and Google registration
- Users cannot select or modify their role during registration |
| FR-RBAC-001.3 | Privileged roles must only be assigned through authorized administrative operations | - `ADMIN` and `SUPER_ADMIN` cannot be assigned through public registration |
| FR-RBAC-001.4 | System must enforce role-based permissions on protected operations | - Users can perform only actions permitted by their assigned role |
| FR-RBAC-001.5 | Users must not be able to modify their own role | - Self-promotion and self-demotion are rejected |
| FR-RBAC-001.6 | Role changes must be atomic and auditable | - Actor, target, previous role, new role, action and timestamp are recorded |

### FR-RBAC-002: Authorization Middleware

**Priority**: CRITICAL

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-002.1 | Protected routes must require a valid Better Auth session | - Missing or invalid session → HTTP 401 Unauthorized |
| FR-RBAC-002.2 | Middleware must enforce route-level role restrictions | - Insufficient role or permission → HTTP 403 Forbidden |
| FR-RBAC-002.3 | Sensitive operations must perform explicit authorization checks | - Privileged operations, including role management, cannot rely only on authentication |
| FR-RBAC-002.4 | Authorization must be enforced server-side | - Client-side restrictions cannot bypass backend authorization |
| FR-RBAC-002.5 | Authorization design must support future granular permissions | - Permission rules can be extended without redesigning the authentication layer |

### FR-RBAC-003: Super Admin Role Management

**Priority**: CRITICAL

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-003.1 | Super Admin can create Admin accounts | - New account is assigned the `ADMIN` role |
| FR-RBAC-003.2 | Super Admin can manage Admin accounts | - Authorized account actions follow the defined account lifecycle rules |
| FR-RBAC-003.3 | Super Admin can promote an Admin to Super Admin | - `ADMIN → SUPER_ADMIN` |
| FR-RBAC-003.4 | Super Admin can demote another Super Admin to Admin | - `SUPER_ADMIN → ADMIN` |
| FR-RBAC-003.5 | Super Admin can perform authorized account management operations on other Super Admin accounts | - Operations must follow the defined role hierarchy and account lifecycle rules |
| FR-RBAC-003.6 | Super Admin cannot modify their own role | - Attempts to change their own role are rejected |
| FR-RBAC-003.7 | Super Admin role changes must be atomic and auditable | - Actor, target, previous role, new role, action and timestamp are recorded |

**Role Transition Rules:**

```
Promote:
ADMIN → SUPER_ADMIN

Demote:
SUPER_ADMIN → ADMIN
```

### FR-RBAC-004: Admin Restrictions on Privileged Accounts

**Priority**: HIGH

> Admins have no authority to create, modify, remove, suspend or change the role of `ADMIN` or `SUPER_ADMIN` accounts.
> 

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-004.1 | Admin cannot create privileged accounts | - Attempts to create accounts with `ADMIN` or `SUPER_ADMIN` roles → HTTP 403 Forbidden |
| FR-RBAC-004.2 | Admin cannot manage other Admin accounts | - Attempts to modify, suspend, deactivate or remove another `ADMIN` account → HTTP 403 Forbidden |
| FR-RBAC-004.3 | Admin cannot manage Super Admin accounts | - Attempts to modify, suspend, deactivate or remove a `SUPER_ADMIN` account → HTTP 403 Forbidden |
| FR-RBAC-004.4 | Admin cannot change the role of another privileged account | - `ADMIN → SUPER_ADMIN` or `SUPER_ADMIN → ADMIN` attempts → HTTP 403 Forbidden |
| FR-RBAC-004.5 | Admin cannot modify their own role | - Attempts to change their own role → HTTP 403 Forbidden |
| FR-RBAC-004.6 | Unauthorized attempts to manage privileged accounts must be auditable | - Actor, target, attempted action and timestamp are recorded even when the request is rejected |

### FR-RBAC-005: Resource Ownership Validation

**Priority**: HIGH

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-005.1 | Customers may only access or modify resources they own | - Cross-account access or modification attempts → HTTP 403 Forbidden |
| FR-RBAC-005.2 | Customer-owned resources must be validated against the authenticated user | - Protected resources, including profile, inquiries, cart, orders and other account-related data, cannot be accessed or modified by another customer |
| FR-RBAC-005.3 | Administrative access must follow assigned permissions | - `ADMIN` and `SUPER_ADMIN` users can access resources only within their authorized scope |
| FR-RBAC-005.4 | Sensitive administrative resource access must be auditable | - Actor, resource, action and timestamp are recorded where required |

### FR-RBAC-006: Account Status Enforcement

**Priority**: HIGH

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-RBAC-006.1 | System must enforce account status during authentication and authorization | - Suspended, deactivated or soft-deleted accounts cannot authenticate or access protected resources |
| FR-RBAC-006.2 | Restricting an account must invalidate its active sessions | - Suspended or deactivated accounts can no longer use existing sessions to access protected resources |
| FR-RBAC-006.3 | Account status changes must be auditable | - Actor, target, previous status, new status, action and timestamp are recorded |
| FR-RBAC-006.4 | Soft-deleted accounts must be excluded from normal system operations | - Soft-deleted accounts are excluded from active-user queries and cannot authenticate or access protected resources |

## 2.3 User Profile Management

> **Profile Management Model:** Authentication credentials are managed through Better Auth, while business profile information is managed at the application level. Profile and account management follow the access boundaries defined in the RBAC module.
> 

### FR-ADMIN-001: Create Admin User

**Priority**: HIGH

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-ADMIN-001.1 | Only Super Admin can create an Admin account | - Required user information must be provided
- Role is assigned as `ADMIN`
- Attempt by an Admin or Customer → HTTP 403 Forbidden |
| FR-ADMIN-001.2 | This operation must not create or assign a `SUPER_ADMIN` role | - Any attempt to create a `SUPER_ADMIN` through this operation → HTTP 403 Forbidden |
| FR-ADMIN-001.3 | Admin accounts must follow the configured administrative account creation process | - Public self-registration for Admin accounts is not supported |
| FR-ADMIN-001.4 | Admin account creation must be auditable | - Actor, target, action and timestamp are recorded |

**Error Scenarios:**

- Unauthorized request → HTTP 403 Forbidden
- Duplicate email → HTTP 409 Conflict
- Invalid or missing required data → HTTP 400 Bad Request
- Attempt to create or assign `SUPER_ADMIN` through this operation → HTTP 403 Forbidden

---

### FR-ADMIN-002: Update Admin Profile

**Priority**: MEDIUM

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-ADMIN-002.1 | Only Super Admin can update another Admin's permitted profile information | - Name, contact information and other permitted profile fields can be updated
- Attempt by an `ADMIN` → HTTP 403 Forbidden |
| FR-ADMIN-002.2 | Only Super Admin can modify an Admin's role | - Role changes must follow the role transition rules defined in FR-RBAC-003 |
| FR-ADMIN-002.3 | Admin cannot modify another Admin or any Super Admin account | - Unauthorized attempt → HTTP 403 Forbidden |
| FR-ADMIN-002.4 | Super Admin can manage an Admin account's status | - An Admin account can be suspended or reactivated according to account lifecycle rules
- Active sessions are revoked when the account is suspended |
| FR-ADMIN-002.5 | Admin account changes must be auditable | - Actor, target, action, previous value, new value and timestamp are recorded where applicable |

**Error Scenarios:**

- Unauthorized request → HTTP 403 Forbidden
- Admin account not found → HTTP 404 Not Found
- Invalid profile data → HTTP 400 Bad Request
- Invalid account status transition → HTTP 422 Unprocessable Entity

---

### FR-ADMIN-003: Get Admin List

**Priority**: MEDIUM

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-ADMIN-003.1 | Only Super Admin can retrieve the list of Admin accounts | - Attempt by an `ADMIN` or `CUSTOMER` → HTTP 403 Forbidden |
| FR-ADMIN-003.2 | The Admin list must support standard query capabilities | - Supports pagination, search, sorting and account status filtering |
| FR-ADMIN-003.3 | The Admin list must only include accounts with the `ADMIN` role | - `SUPER_ADMIN` and `CUSTOMER` accounts are excluded |

**Success Response**: HTTP 200 OK

```json
{
  "success": true,
  "message": "Admins retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1
  }
}
```

### FR-CUSTOMER-001: Update Customer Profile

**Priority**: HIGH

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-CUSTOMER-001.1 | Customers can update their own permitted profile information | - Name, contact number, address and avatar can be updated according to field validation rules |
| FR-CUSTOMER-001.2 | Authorized administrative users can update permitted customer profile information | - `ADMIN` and `SUPER_ADMIN` access follows assigned permissions
- Authentication credentials and provider account data cannot be modified through profile management |
| FR-CUSTOMER-001.3 | Customers can update their own email address through the supported account management flow | - The new email must pass validation and uniqueness checks
- Email verification requirements must be applied after the change |
| FR-CUSTOMER-001.4 | Changing an email address must update its verification state appropriately | - The new email remains unverified until successfully verified, unless the configured authentication provider supplies a trusted verified identity |
| FR-CUSTOMER-001.5 | Customer profile updates must enforce ownership and authorization rules | - Customers cannot update another customer's profile
- Unauthorized access → HTTP 403 Forbidden |

**Error Scenarios:**

- Unauthorized profile update → HTTP 403 Forbidden
- Customer not found → HTTP 404 Not Found
- Invalid profile data → HTTP 400 Bad Request
- Duplicate email → HTTP 409 Conflict

---

### FR-CUSTOMER-002: Get Customer List

**Priority**: MEDIUM

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-CUSTOMER-002.1 | `SUPER_ADMIN` and `ADMIN` can retrieve the customer list | - `CUSTOMER` access → HTTP 403 Forbidden |
| FR-CUSTOMER-002.2 | The customer list must support standard query capabilities | - Supports pagination, name/email search, sorting, account status filtering and creation date range filtering |
| FR-CUSTOMER-002.3 | The customer list must only include accounts with the `CUSTOMER` role | - `ADMIN` and `SUPER_ADMIN` accounts are excluded from the result |

**Success Response**: HTTP 200 OK

```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "status": "ACTIVE",
      "createdAt": "datetime"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

### FR-CUSTOMER-003: Get Customer by ID

**Priority**: MEDIUM

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-CUSTOMER-003.1 | `SUPER_ADMIN` and `ADMIN` can view a customer's permitted administrative profile | - Returns permitted profile information and relevant order and inquiry summaries |
| FR-CUSTOMER-003.2 | Customers can view their own profile | - A customer can access their own permitted account and profile information |
| FR-CUSTOMER-003.3 | Customers cannot access another customer's profile | - Cross-customer access → HTTP 403 Forbidden |
| FR-CUSTOMER-003.4 | Customer data access must enforce role and ownership rules | - Administrative access follows assigned permissions
- Customer access is limited to the authenticated user's own account |

**Error Scenarios:**

- Unauthorized access → HTTP 403 Forbidden
- Customer not found → HTTP 404 Not Found

---

### FR-CUSTOMER-004: Suspend / Deactivate / Soft Delete Customer

**Priority**: MEDIUM

**Requirements:**

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-CUSTOMER-004.1 | `SUPER_ADMIN` and `ADMIN` can suspend a customer account | - Suspended customers cannot access protected resources |
| FR-CUSTOMER-004.2 | `SUPER_ADMIN` and `ADMIN` can deactivate a customer account | - Deactivated customers cannot authenticate or access protected resources |
| FR-CUSTOMER-004.3 | `SUPER_ADMIN` and `ADMIN` can soft-delete a customer account according to their assigned permissions. | - Account is excluded from normal active-user queries
- Business records are preserved and not physically deleted |
| FR-CUSTOMER-004.4 | Customer sessions must be revoked when an account is suspended, deactivated or soft-deleted | - Existing sessions can no longer authorize protected requests |
| FR-CUSTOMER-004.5 | Customer account status changes must be auditable | - Actor, target, previous status, new status, action and timestamp are recorded |
| FR-CUSTOMER-004.6 | Customers cannot modify their own account status | - Self-suspension, deactivation or deletion → HTTP 403 Forbidden |

**Error Scenarios:**

- Unauthorized access → HTTP 403 Forbidden
- Customer not found → HTTP 404 Not Found
- Invalid account status transition → HTTP 422 Unprocessable Entity