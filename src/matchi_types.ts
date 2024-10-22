export interface MatchiWebhookJson {
  detail: CreatedBookingObject | CancelledBookingObject | MovedBookingObject;
  timestamp: string;
  id: string;
  ["detail-type"]: string;
}

export interface CreatedBookingObject {
  issuerId: string;
  players: MatchiPlayer[];
  owner: MatchiOwner;
  booking: MatchiBooking;
  facility: MatchiFacility;
}

export interface CancelledBookingObject {
  owner: MatchiOwner;
  booking: MatchiCancelledBooking;
  facility: MatchiFacility;
}

export interface MovedBookingObject {
  booking: MatchiBooking;
  facility: MatchiFacility;
}

export interface MatchiOwner {
  customerId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  zipcode: string;
  country: string;
  nationality: string;
  cellphone: string;
  telephone: string;
  dateOfBirth: string;
  gender: string;
  isOrganization: boolean;
  doNotEmail: boolean;
  registrationDate: string;
}

export interface MatchiBaseBooking {
  bookingId: string;
  courtId: string;
  courtName: string;
}

export interface MatchiBooking extends MatchiBaseBooking {
  startTime: string;
  endTime: string;
  accessCode: string;
  splitPayment: boolean;
}

export interface MatchiCancelledBooking extends MatchiBaseBooking {}

export interface MatchiFacility {
  facilityId: string;
  facilityName: string;
}

export interface MatchiPlayer {
  userId: string;
  email: string;
  isCustomer: boolean;
}
