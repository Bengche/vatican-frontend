export interface Park {
  id: string | number;
  name: string;
  city: string;
  region?: string;
  address?: string | null;
}

export interface Trip {
  id: string | number;
  travelDate: string;
  departureTime: string;
  travelShift: string;
  price: number;
  busId: string | number;
  busNumber: string;
  busType?: string;
  capacity: number;
  availableSeats: number;
  fromParkId: string | number;
  toParkId: string | number;
  fromCity: string;
  toCity: string;
  fromParkName: string;
  toParkName: string;
}

export interface RoutePage {
  fromCity: string;
  toCity: string;
  slug: string;
  minPrice: number | null;
  upcomingTrips: number;
  fromParkId: string | number;
  toParkId: string | number;
  fromParks: string[];
  toParks: string[];
}

export interface Seat {
  id: string | number;
  seatLabel: string;
  rowNum: number;
  colNum: number;
  isAisle: boolean;
  isWindow?: boolean;
  isBooked: boolean;
  isCounterBooking?: boolean;
  passengerGender?: string | null;
  passengerAge?: number | null;
  discussionPreference?: string | null;
}

export interface Quote {
  seatCount: number;
  unitPrice: number;
  baseFare: number;
  terminalFee: number;
  serviceFee: number;
  gatewayFee: number;
  totalAmount: number;
}

export interface PassengerInput {
  seatId: string | number;
  name: string;
  idCardNumber: string;
  age: string;
  gender: "male" | "female" | "other";
}

export interface BookingRecord {
  booking_id: number | string;
  booking_ref: string;
  qr_code_hash: string;
  total_amount_fcfa: number;
  booking_status: string;
  payment_method: string;
  booked_at: string;
  transaction_ref?: string | null;
  travel_date: string;
  departure_time: string;
  travel_shift: string;
  unit_price: number;
  bus_number: string;
  bus_type?: string;
  origin_city: string;
  origin_park: string;
  destination_city: string;
  destination_park: string;
  seats: {
    seat_label: string;
    passenger_name: string;
    id_card_number?: string | null;
    passenger_age?: number | null;
    passenger_gender?: string | null;
  }[];
  breakdown: { baseFare: number; fees: number; total: number };
}

export interface AdminTrip {
  id: number | string;
  bus_id: number | string;
  bus_number: string;
  total_seats: number;
  booked_seats: string | number;
  origin_city: string;
  origin_park: string;
  destination_city: string;
  destination_park: string;
  travel_date: string;
  departure_time: string;
  travel_shift: string;
  price_fcfa: number;
  status: string;
}

export interface Bus {
  id: number | string;
  bus_number: string;
  park_id: number | string;
  total_seats: number;
  bus_type: string;
  is_active: boolean;
}
