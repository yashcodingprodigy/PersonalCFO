// Indian states / UTs and their major cities.
// Used to drive the dependent State → City dropdowns at onboarding & settings.
// Not exhaustive (India has thousands of towns) — covers the cities most users
// live in, plus an "Other" escape hatch so no one is blocked.

export const INDIA: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kurnool', 'Rajahmundry', 'Kakinada'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Anand'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Rohtak', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Manali'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari', 'Tumakuru'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Kottayam'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Solapur', 'Kolhapur'],
  'Manipur': ['Imphal', 'Thoubal'],
  'Meghalaya': ['Shillong', 'Tura'],
  'Mizoram': ['Aizawl', 'Lunglei'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
  'Sikkim': ['Gangtok', 'Namchi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'Tripura': ['Agartala', 'Udaipur (Tripura)'],
  'Uttar Pradesh': ['Noida', 'Ghaziabad', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Bareilly', 'Aligarh'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Haldwani', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman'],
  // Union Territories
  'Andaman & Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra & Nagar Haveli and Daman & Diu': ['Daman', 'Silvassa', 'Diu'],
  'Delhi': ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Puducherry', 'Karaikal'],
};

export const STATES = Object.keys(INDIA).sort();

export function citiesForState(state: string): string[] {
  return state && INDIA[state] ? [...INDIA[state], 'Other'] : [];
}

// Metro tier drives HRA exemption (50% vs 40% of basic) and cost-of-living notes.
const METRO_CITIES = new Set([
  'Mumbai', 'Navi Mumbai', 'Thane', 'Delhi', 'New Delhi', 'Kolkata', 'Howrah', 'Chennai',
  'Bengaluru', 'Hyderabad', 'Pune', 'Gurugram', 'Noida', 'Ghaziabad', 'Faridabad',
]);

export function isMetro(city: string): boolean {
  return METRO_CITIES.has(city);
}
