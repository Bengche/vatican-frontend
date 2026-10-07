import { api } from "./api";

/** Downloads the server-generated PDF e-ticket for a confirmed booking. */
export async function downloadTicket(
  bookingId: string | number,
  bookingRef: string,
) {
  const { data } = await api.get<Blob>(`/bookings/${bookingId}/ticket.pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `Ticket-${bookingRef}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
