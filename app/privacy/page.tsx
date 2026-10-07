import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "../components/LegalPage";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${brand.name} collects, uses and protects your personal information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      intro={`${brand.legalName} respects your privacy. This policy explains what we collect when you use this website, why we collect it and the choices you have.`}
    >
      <LegalSection title="1. What we collect">
        <ul>
          <li>
            <strong>Account details:</strong> name, phone number, email address,
            age, gender and a password (stored only in scrambled form).
          </li>
          <li>
            <strong>Passenger details:</strong> for every seat, the passenger&apos;s
            name, identity document number, age, gender and seating preference.
            Transport regulations require us to keep a passenger manifest.
          </li>
          <li>
            <strong>Payment details:</strong> the Mobile Money number used to pay
            and the transaction reference. We never see or store your Mobile
            Money PIN.
          </li>
          <li>
            <strong>Technical data:</strong> a sign-in token kept in your browser
            so you stay signed in, and basic server logs used to keep the
            service secure.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Why we use it">
        <ul>
          <li>To reserve seats, take payment and issue your ticket.</li>
          <li>To verify tickets at boarding and keep the legally required manifest.</li>
          <li>To send receipts, tickets, cancellation notices and security emails such as password resets.</li>
          <li>To handle refunds, support requests and fraud prevention.</li>
          <li>To keep accounting records and meet legal obligations.</li>
        </ul>
        <p>We do not sell your personal information and we do not use it for third-party advertising.</p>
      </LegalSection>

      <LegalSection title="3. Who we share it with">
        <ul>
          <li>Our payment service provider, to collect your payment and to send refunds.</li>
          <li>Our email delivery provider, to send you tickets and notices.</li>
          <li>Our terminal and boarding staff, who see the details needed to check you in.</li>
          <li>Transport and security authorities, when the law requires it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How long we keep it">
        <p>
          We keep booking, manifest and payment records for as long as needed to
          provide the service, resolve disputes and meet accounting and
          transport-regulation requirements. You can ask us to close your account
          at any time.
        </p>
      </LegalSection>

      <LegalSection title="5. Security">
        <p>
          Connections to this website are encrypted, passwords are stored in
          scrambled form, staff access is limited by role and password reset links
          expire after 60 minutes. No system is perfectly secure, so please keep
          your password private.
        </p>
      </LegalSection>

      <LegalSection title="6. Your choices">
        <p>
          You may ask to see, correct or delete the personal information we hold
          about you, subject to our legal record-keeping duties. Write to{" "}
          <a href={`mailto:${brand.support.email}`} className="font-semibold text-primary hover:underline">
            {brand.support.email}
          </a>{" "}
          or call {brand.support.phone}.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>
          Accounts are for adults. A parent or guardian may buy tickets for a
          child and enter the child&apos;s details as a passenger.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes">
        <p>
          We may update this policy. The date at the top shows when it last
          changed. See also our{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            terms of service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          {brand.legalName}, {brand.headOffice}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}