# Microsoft admin authentication setup

Tufffinds admin pages use Firebase Authentication for identity and Firestore for
authorisation. Microsoft sign-in proves identity; it does not grant admin access
by itself. Every administrator must also have an active `admin_users/{uid}`
document whose `role` is `admin`.

The Microsoft client secret belongs only in the Microsoft Entra and Firebase
consoles. Do not add it to this repository, Vercel environment variables, or
browser code.

## Application requirements

The application uses Firebase's `microsoft.com` OAuth provider for admin sign-in.
The admin guard permits access only when the signed-in Firebase user's matching
Firestore document contains exactly:

```text
active: true
role: "admin"
```

Do not replace this UID-based approval with an email or email-domain check.

## 1. Register the Microsoft Entra application

1. In the Microsoft Entra admin centre, open **Identity > Applications > App
   registrations** and choose **New registration**.
2. Give the application a clear production name such as `Tufffinds Admin`.
3. Select the narrowest supported account type that includes every intended
   administrator:
   - Choose **Accounts in this organizational directory only** when all admins
     use accounts in the same Tufffinds Microsoft 365 tenant. This is the
     recommended setting for a company-only admin portal.
   - Choose **Accounts in any organizational directory and personal Microsoft
     accounts** only if authorised admins must use other tenants or personal
     Outlook.com accounts.
4. Complete the registration and retain the displayed **Application (client)
   ID** for entry in Firebase Console.

## 2. Add the Firebase callback URI

1. In Firebase Console, open **Authentication > Sign-in method > Microsoft**.
2. Copy the exact authorization callback/redirect URI displayed by Firebase.
   It normally has the form
   `https://<firebase-project-id>.firebaseapp.com/__/auth/handler`.
3. In the Entra application, open **Authentication > Add a platform > Web** and
   add that exact URI as a redirect URI.

Use the URI displayed by Firebase rather than constructing one manually. If the
Firebase authentication domain changes, add the corresponding callback URI in
Entra before switching domains.

## 3. Create and configure the client secret

1. In the Entra application, open **Certificates & secrets > Client secrets >
   New client secret**.
2. Choose an appropriate expiry and record an internal rotation reminder.
3. Copy the secret **Value** immediately. Do not copy it into a source file,
   `.env` file, Vercel, chat, or documentation.
4. Return to **Firebase Console > Authentication > Sign-in method > Microsoft**.
5. Enable the provider and enter the Entra **Application (client) ID** and
   client secret value, then save.

## 4. Configure Firebase authorized domains

In **Firebase Console > Authentication > Settings > Authorized domains**, add
every exact host that will initiate sign-in:

- `tufffinds.com`
- `www.tufffinds.com` if that host serves or redirects through the application
- the production Vercel hostname
- each Vercel preview hostname that administrators will use for testing

Firebase authorized domains should contain hostnames only, without `https://`
or paths. Add exact preview hosts; do not assume a wildcard is accepted.

## 5. Configure Vercel environment variables

Set the Firebase web configuration in Vercel for Production and for every
Preview environment used for admin testing. Obtain the values from **Firebase
Console > Project settings > Your apps > Web app configuration**:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_SITE_URL=https://tufffinds.com
```

The Firebase web configuration is public client configuration, not a Microsoft
secret. Never put the Microsoft client secret in Vercel. Redeploy each affected
Vercel environment after changing its variables.

## 6. Approve each administrator by Firebase UID

1. After the Microsoft provider and authorized domain are configured, have the
   administrator sign in once at `/admin` using **Sign in with Microsoft**.
2. Find the newly authenticated account in **Firebase Console > Authentication
   > Users** and copy its Firebase **UID**.
3. In Firestore, create the document `admin_users/{uid}` with exactly:

   ```text
   active: true
   role: "admin"
   ```

4. Reload `/admin` and confirm the approved account can access the dashboard.
5. Confirm a different authenticated Microsoft account without this Firestore
   document sees **Access denied** and no admin data.

Do not authorise by email domain. Removing the document, setting `active` to
`false`, or changing `role` immediately removes access through the existing
Firestore listener and security rules.

## 7. Production verification

Before launch, verify on the production and intended preview domains:

- An unauthenticated visitor to `/admin` sees the Microsoft sign-in screen.
- Microsoft sign-in succeeds without popup or unauthorized-domain errors.
- Popup cancellation and blocked-popup messages are understandable.
- An authenticated but unapproved Microsoft account sees a simple access-denied
  screen without UID, role, document-existence, or other internal diagnostics.
- An approved `admin_users/{uid}` account can open `/admin` and
  `/admin/email-signups`.
- No admin collection data is requested before the admin record is approved.
- Sign out returns the user to the protected authentication gate.
