import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "../components/LegalPage";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms that apply when you book and travel with ${brand.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      intro={`These terms apply to every booking made on this website and to every journey operated by ${brand.legalName} ("${brand.name}", "we", "us"). By creating an account or paying for a ticket you accept them.`}
    >
      <LegalSection title="1. Bookings and payment">
        <ul>
          <li>
            A seat is reserved for you for a few minutes while you pay. It is
            confirmed only when we receive your payment ({brand.payments}).
          </li>
          <li>
            The total shown before payment includes the fare, terminal and
            service fees and the Mobile Money network fee. Prices are in XAF.
          </li>
          <li>
            If you pay after your reserved seats have been released and they
            were taken by another passenger, we refund the full amount you paid
            to the same Mobile Money number.
          </li>
          <li>
            You are responsible for entering correct passenger details. We may
            refuse boarding, or ask for a correction, if details do not match
            the identity document.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Tickets and identification">
        <ul>
          <li>
            Each ticket is personal to the passenger named on it and is valid
            only for the date, departure and seat shown.
          </li>
          <li>
            Every passenger must carry a valid identity document (national ID
            card, passport or student ID). Names on the ticket must match the
            document.
          </li>
          <li>
            Each ticket carries a unique QR code that is verified at the
            terminal and at checkpoints. A ticket can be used once. We may
            refuse a ticket that has been copied, altered or already used.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Boarding and baggage">
        <ul>
          <li>
            Please arrive at your departure terminal at least{" "}
            {brand.boardingMinutes} minutes before departure. Buses leave on
            time and do not wait for late passengers.
          </li>
          <li>
            A passenger who misses the departure, for any reason, has no right
            to a refund or a replacement seat.
          </li>
          <li>
            Baggage is carried at the owner&apos;s risk within the limits set
            by the terminal. Dangerous, illegal or perishable goods may not be
            carried.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Changes and cancellations">
        <p>
          If you need to cancel, contact customer care with your booking
          reference. Refunds follow our{" "}
          <Link href="/refund-policy" className="font-semibold text-primary hover:underline">
            refund policy
          </Link>
          . If we cancel or cannot operate a departure, you receive a full
          refund of everything you paid, including fees.
        </p>
        <p>
          We may change a departure time or bus for operational or safety
          reasons. We will notify you using the contact details on your booking.
        </p>
      </LegalSection>

      <LegalSection title="5. Your account">
        <ul>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>Give accurate information and do not use the service for anything unlawful.</li>
          <li>
            We may suspend accounts that are used to abuse the service or to
            attempt fraud.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Conduct on board">
        <p>
          Passengers must follow the instructions of the driver and crew and
          respect other travellers. We may refuse or end carriage, without
          refund, for dangerous, abusive or unlawful behaviour.
        </p>
      </LegalSection>

      <LegalSection title="7. Our responsibility">
        <p>
          We operate our services with reasonable care and skill. To the extent
          permitted by law, we are not liable for delays or disruption caused
          by events beyond our control, such as road conditions, weather,
          security restrictions or mechanical breakdown, but we will make
          reasonable efforts to get you to your destination or to refund you.
          Nothing in these terms limits any liability that cannot be limited
          under Cameroonian law.
        </p>
      </LegalSection>

      <LegalSection title="8. Personal data">
        <p>
          How we use your information is described in our{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these terms and governing law">
        <p>
          We may update these terms from time to time. The version published on
          this page when you book applies to that booking. These terms are
          governed by the laws of the Republic of Cameroon and the Cameroonian
          courts have jurisdiction, without affecting any mandatory consumer
          rights you may have.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          {brand.legalName}, {brand.headOffice}.<br />
          Phone {brand.support.phone}, email{" "}
          <a href={`mailto:${brand.support.email}`} className="font-semibold text-primary hover:underline">
            {brand.support.email}
          </a>
          . {brand.support.hours}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}