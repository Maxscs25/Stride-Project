/**
 * Terms of Service and Privacy Policy content, written to match Stride's
 * actual data practices. Rendered in-app (src/app/legal/*) and exported to
 * static HTML for the public App Store URL (scripts/build-legal.mjs).
 *
 * NOTE: this is a tailored draft, not legal advice — have a lawyer review it
 * before a public launch, and replace the [bracketed] placeholders.
 */

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

const CONTACT = '[support@stride.app]';
const ENTITY = '[Your Name / Company]';
const UPDATED = 'July 23, 2026';

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: UPDATED,
  intro:
    'Stride ("we", "us") helps runners train and stay healthy. This policy explains what we collect, how we use it, and the choices you have. We treat your training and health information as sensitive, and we do not sell it.',
  sections: [
    {
      heading: '1. Information you provide',
      body: [
        'Account: your email address when you create an account.',
        'Profile & goals: optional details like name, age, sex, height, weight, experience level, weekly mileage and race goals. Height/weight/age are used only to estimate calorie and macro targets.',
        'Training data: runs, cross-training, shoes, and the journal — including free-text notes and wellness sliders (energy, soreness, stress, sleep).',
        'Nutrition & hydration: foods you log and water intake.',
        'Running-form videos: clips you record or choose for gait analysis.',
      ],
    },
    {
      heading: '2. Health data from Apple Health (HealthKit)',
      body: [
        'If you connect Apple Health, we read running workouts (and, where available, heart rate and distance) so your watch runs appear automatically.',
        'Health data obtained through HealthKit is used only to provide Stride\'s features. We do not use it for advertising or marketing, and we do not share it with third parties for those purposes. We do not sell it.',
        'You can turn off Health access at any time in the iOS Settings → Health app.',
      ],
    },
    {
      heading: '3. How we use your information',
      body: [
        'To provide the app: log and sync your training, track shoe mileage, compute training-load metrics, and generate your daily checklist.',
        'To give AI coaching: we send relevant, minimized data — such as journal note text, computed training signals, and gait metrics — to our AI provider to produce educational insights and form reports. This is not a medical diagnosis.',
        'To power features: barcodes and food search terms are sent to food databases to look up nutrition information.',
        'We do not use your content to serve you third-party ads.',
      ],
    },
    {
      heading: '4. Service providers (subprocessors)',
      body: [
        'Supabase — hosts our database, authentication, and file storage.',
        'Anthropic — processes the data described above to generate AI insights and reports. Under its API terms, inputs are not used to train its models.',
        'RevenueCat and Apple — process subscription purchases and manage entitlements. Payment card details are handled by Apple, never by us.',
        'Open Food Facts and USDA FoodData Central — provide food/nutrition lookups from the barcode or search term sent.',
        'These providers process data only to deliver their part of the service.',
      ],
    },
    {
      heading: '5. Running-form videos',
      body: [
        'Pose estimation runs on your device. Videos you analyze are stored in a private, access-controlled bucket and are automatically deleted after 30 days; the computed metrics and report are kept with your account.',
        'Only you can access your videos unless you explicitly share results.',
      ],
    },
    {
      heading: '6. Coach sharing',
      body: [
        'Sharing with a coach is off by default and entirely opt-in. You choose exactly what a coach can see (mileage, workouts, wellness, notes, nutrition, checklist) and can change or revoke access at any time. Revoking access takes effect immediately.',
      ],
    },
    {
      heading: '7. Data retention & your rights',
      body: [
        'Your data is retained while your account is active. You can export your data or delete your account from within the app; deletion removes your personal data (subject to short operational backups).',
        'Depending on where you live (e.g., EEA/UK under GDPR, California under CCPA/CPRA), you may have rights to access, correct, delete, or port your data, and to object to certain processing. Contact us to exercise these rights.',
      ],
    },
    {
      heading: '8. Security',
      body: [
        'Data is encrypted in transit and at rest. Access to your records is enforced at the database with row-level security so only you — and coaches you have authorized — can read them.',
      ],
    },
    {
      heading: '9. Children',
      body: [
        'Stride is intended for users aged 13 and older. We do not knowingly collect data from children under 13. For users under 18, we apply conservative nutrition guidance and do not provide calorie-deficit or weight-loss coaching.',
      ],
    },
    {
      heading: '10. Not medical advice',
      body: [
        'Stride provides educational and training guidance only. It is not a medical device and does not diagnose, treat, or prevent any condition. Always consult a qualified professional for medical concerns.',
      ],
    },
    {
      heading: '11. Changes & contact',
      body: [
        'We may update this policy; material changes will be reflected by the "Last updated" date and, where appropriate, in-app notice.',
        `Questions or requests: ${CONTACT}. Data controller: ${ENTITY}.`,
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  updated: UPDATED,
  intro:
    'These Terms govern your use of the Stride app. By creating an account or using Stride, you agree to them. If you do not agree, do not use the app.',
  sections: [
    {
      heading: '1. Eligibility',
      body: ['You must be at least 13 years old to use Stride.'],
    },
    {
      heading: '2. The service',
      body: [
        'Stride is a running-training app offering logging, analytics, AI coaching, nutrition guidance, coach sharing, and running-form analysis. Features may change over time.',
      ],
    },
    {
      heading: '3. Not medical or professional advice',
      body: [
        'All guidance — including injury-prevention insights, nutrition estimates, and form analysis — is for educational and training purposes only. It is not medical advice, diagnosis, or treatment, and cannot replace evaluation by a qualified healthcare or sports-medicine professional. Running mechanics cannot be fully assessed from a phone camera. You use this guidance at your own risk and are responsible for training within your limits.',
      ],
    },
    {
      heading: '4. Subscriptions & billing',
      body: [
        'Stride offers a free tier and an optional paid subscription (Stride Premium). Paid subscriptions are sold through the Apple App Store and billed to your Apple ID.',
        'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Any free trial converts to a paid subscription unless cancelled before it ends. Manage or cancel in your App Store account settings.',
        'Prices are shown in the app before purchase and may change with notice.',
      ],
    },
    {
      heading: '5. Your content',
      body: [
        'You own the content you create (journal entries, videos, logs). You grant us a limited license to store and process it solely to operate the app and provide the features you use, as described in the Privacy Policy.',
        'You are responsible for the content you upload and for having the right to share anything you record.',
      ],
    },
    {
      heading: '6. Acceptable use',
      body: [
        'Do not misuse the service: no unlawful use, no attempts to breach security or access others\' data, no reverse engineering, and no automated scraping of the service.',
      ],
    },
    {
      heading: '7. Third-party integrations',
      body: [
        'Stride integrates with services like Apple Health. Your use of those services is governed by their own terms, and their availability is not guaranteed.',
      ],
    },
    {
      heading: '8. Disclaimers & limitation of liability',
      body: [
        'The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages, or for any injury or health outcome arising from your training decisions. Nothing limits liability that cannot be limited by law.',
      ],
    },
    {
      heading: '9. Termination',
      body: [
        'You may stop using Stride and delete your account at any time. We may suspend or terminate access for violations of these Terms.',
      ],
    },
    {
      heading: '10. Changes & governing law',
      body: [
        'We may update these Terms; continued use after changes means you accept them. These Terms are governed by the laws of [your jurisdiction], without regard to conflict-of-laws rules.',
      ],
    },
    {
      heading: '11. Contact',
      body: [`Questions about these Terms: ${CONTACT}.`],
    },
  ],
};
