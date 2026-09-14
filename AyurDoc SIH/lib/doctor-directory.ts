export type DoctorProfile = {
  id: string;
  username: string;
  name: string;
  degree: string;
  department: string;
  hours: string;
  initials: string;
  tone: string;
};

// Previous allopathic catalog retained only for migration reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEGACY_DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEGACY_DOCTORS: DoctorProfile[] = [
  { id: "medicine-01", username: "ananyarao", name: "Dr. Ananya Rao", degree: "MBBS, MD - General Medicine", department: "General Medicine", hours: "Mon-Sat · 8:00 AM-1:00 PM", initials: "AR", tone: "mint" },
  { id: "medicine-02", username: "viveksharma", name: "Dr. Vivek Sharma", degree: "MBBS, MD - General Medicine", department: "General Medicine", hours: "Mon-Fri · 1:00 PM-6:00 PM", initials: "VS", tone: "cyan" },
  { id: "medicine-03", username: "nehakapoor", name: "Dr. Neha Kapoor", degree: "MBBS, DNB - Family Medicine", department: "General Medicine", hours: "Tue-Sun · 9:00 AM-2:00 PM", initials: "NK", tone: "blue" },
  { id: "medicine-04", username: "amitgupta", name: "Dr. Amit Gupta", degree: "MBBS, MD - Internal Medicine", department: "General Medicine", hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "AG", tone: "slate" },
  { id: "medicine-05", username: "priyamenon", name: "Dr. Priya Menon", degree: "MBBS, MD - General Medicine", department: "General Medicine", hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "PM", tone: "rose" },

  { id: "card-01", username: "arjunmehta", name: "Dr. Arjun Mehta", degree: "MBBS, MD - General Medicine, DM - Cardiology", department: "Cardiology", hours: "Mon-Sat · 9:00 AM-1:00 PM", initials: "AM", tone: "coral" },
  { id: "card-02", username: "riyasen", name: "Dr. Riya Sen", degree: "MBBS, MD - Medicine, DNB - Cardiology", department: "Cardiology", hours: "Mon-Fri · 2:00 PM-6:00 PM", initials: "RS", tone: "rose" },
  { id: "card-03", username: "kabirmalhotra", name: "Dr. Kabir Malhotra", degree: "MBBS, MD, DM - Cardiology", department: "Cardiology", hours: "Tue-Sat · 8:30 AM-12:30 PM", initials: "KM", tone: "red" },
  { id: "card-04", username: "sanjaynair", name: "Dr. Sanjay Nair", degree: "MBBS, DNB - Cardiology", department: "Cardiology", hours: "Mon-Sat · 11:00 AM-3:00 PM", initials: "SN", tone: "violet" },
  { id: "card-05", username: "devikabose", name: "Dr. Devika Bose", degree: "MBBS, MD, DM - Cardiology", department: "Cardiology", hours: "Mon-Fri · 4:00 PM-8:00 PM", initials: "DB", tone: "pink" },

  { id: "derma-01", username: "rohandas", name: "Dr. Rohan Das", degree: "MBBS, MD - Dermatology, Venereology & Leprosy", department: "Dermatology", hours: "Mon-Fri · 1:00 PM-5:00 PM", initials: "RD", tone: "mint" },
  { id: "derma-02", username: "ishagupta", name: "Dr. Isha Gupta", degree: "MBBS, MD - Dermatology", department: "Dermatology", hours: "Mon-Sat · 9:00 AM-1:00 PM", initials: "IG", tone: "cyan" },
  { id: "derma-03", username: "meerashah", name: "Dr. Meera Shah", degree: "MBBS, DVD, DNB - Dermatology", department: "Dermatology", hours: "Tue-Sun · 10:00 AM-2:00 PM", initials: "MS", tone: "sun" },
  { id: "derma-04", username: "amitabhroy", name: "Dr. Amitabh Roy", degree: "MBBS, MD - Dermatology", department: "Dermatology", hours: "Mon-Fri · 3:00 PM-7:00 PM", initials: "AR", tone: "slate" },
  { id: "derma-05", username: "farahkhan", name: "Dr. Farah Khan", degree: "MBBS, MD - Dermatology", department: "Dermatology", hours: "Mon-Sat · 12:00 PM-4:00 PM", initials: "FK", tone: "pink" },

  { id: "pedia-01", username: "meeraiyer", name: "Dr. Meera Iyer", degree: "MBBS, MD - Pediatrics", department: "Pediatrics", hours: "Mon-Sat · 8:30 AM-12:30 PM", initials: "MI", tone: "sun" },
  { id: "pedia-02", username: "kavitanayak", name: "Dr. Kavita Nayak", degree: "MBBS, DCH, DNB - Pediatrics", department: "Pediatrics", hours: "Mon-Fri · 1:00 PM-5:00 PM", initials: "KN", tone: "rose" },
  { id: "pedia-03", username: "arunjoshi", name: "Dr. Arun Joshi", degree: "MBBS, MD - Pediatrics", department: "Pediatrics", hours: "Tue-Sun · 9:00 AM-2:00 PM", initials: "AJ", tone: "blue" },
  { id: "pedia-04", username: "nandinisen", name: "Dr. Nandini Sen", degree: "MBBS, MD - Pediatrics, FIAP", department: "Pediatrics", hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "NS", tone: "violet" },
  { id: "pedia-05", username: "raghavbhat", name: "Dr. Raghav Bhat", degree: "MBBS, DNB - Pediatrics", department: "Pediatrics", hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "RB", tone: "teal" },

  { id: "ortho-01", username: "vikramsingh", name: "Dr. Vikram Singh", degree: "MBBS, MS - Orthopedics", department: "Orthopedics", hours: "Tue-Sun · 11:00 AM-4:00 PM", initials: "VS", tone: "blue" },
  { id: "ortho-02", username: "preetinaidu", name: "Dr. Preeti Naidu", degree: "MBBS, MS - Orthopedics", department: "Orthopedics", hours: "Mon-Fri · 8:00 AM-1:00 PM", initials: "PN", tone: "mint" },
  { id: "ortho-03", username: "karanmehra", name: "Dr. Karan Mehra", degree: "MBBS, DNB - Orthopedics", department: "Orthopedics", hours: "Mon-Sat · 2:00 PM-6:00 PM", initials: "KM", tone: "coral" },
  { id: "ortho-04", username: "manojkulkarni", name: "Dr. Manoj Kulkarni", degree: "MBBS, MS - Orthopedics", department: "Orthopedics", hours: "Tue-Sat · 9:30 AM-2:30 PM", initials: "MK", tone: "slate" },
  { id: "ortho-05", username: "anitadey", name: "Dr. Anita Dey", degree: "MBBS, MS - Orthopedics", department: "Orthopedics", hours: "Mon-Fri · 4:00 PM-8:00 PM", initials: "AD", tone: "rose" },
];

export const DEPARTMENTS = [
  "Kayachikitsa (General & Internal Medicine)",
  "Twacha Roga & Dermatology (Skin Clinic)",
  "Shalya Tantra (Surgery, Ortho & Wound Care)",
  "Prasuti Tantra & Stri Roga (Gynecology)",
  "Shalakya Tantra (ENT & Ophthalmology)",
  "Kaumarabhritya / Bala Roga (Ayurvedic Pediatrics)",
  "Panchakarma & Rehabilitation",
  "Swasthavritta & Yoga (Preventive Lifestyle Care)",
  "Manasa Roga (Mental Health, Sleep & Stress)",
] as const;

const ALL_DOCTORS: DoctorProfile[] = [
  { id: "kaya-01", username: "ananyasharma", name: "Dr. Ananya Sharma", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[0], hours: "Mon-Sat · 8:00 AM-1:00 PM", initials: "AS", tone: "mint" },
  { id: "kaya-02", username: "raghavmenon", name: "Dr. Raghav Menon", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[0], hours: "Mon-Fri · 1:00 PM-6:00 PM", initials: "RM", tone: "cyan" },
  { id: "kaya-03", username: "meerakulkarni", name: "Dr. Meera Kulkarni", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[0], hours: "Tue-Sun · 9:00 AM-2:00 PM", initials: "MK", tone: "blue" },
  { id: "kaya-04", username: "arvindjoshi", name: "Dr. Arvind Joshi", degree: "BAMS, PhD - Kayachikitsa", department: DEPARTMENTS[0], hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "AJ", tone: "slate" },
  { id: "kaya-05", username: "kavyanair", name: "Dr. Kavya Nair", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[0], hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "KN", tone: "rose" },
  { id: "twacha-01", username: "rohandas", name: "Dr. Rohan Das", degree: "BAMS, MD (Ayurveda) - Kayachikitsa, Twacha Roga focus", department: DEPARTMENTS[1], hours: "Mon-Fri · 1:00 PM-5:00 PM", initials: "RD", tone: "mint" },
  { id: "twacha-02", username: "ishagupta", name: "Dr. Isha Gupta", degree: "BAMS, MD (Ayurveda) - Roga Nidana, Skin Clinic", department: DEPARTMENTS[1], hours: "Mon-Sat · 9:00 AM-1:00 PM", initials: "IG", tone: "cyan" },
  { id: "twacha-03", username: "devikabose", name: "Dr. Devika Bose", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[1], hours: "Tue-Sun · 10:00 AM-2:00 PM", initials: "DB", tone: "sun" },
  { id: "twacha-04", username: "sameerpatil", name: "Dr. Sameer Patil", degree: "BAMS, MD (Ayurveda) - Dravyaguna", department: DEPARTMENTS[1], hours: "Mon-Fri · 3:00 PM-7:00 PM", initials: "SP", tone: "slate" },
  { id: "twacha-05", username: "nehapillai", name: "Dr. Neha Pillai", degree: "BAMS, MD (Ayurveda) - Kayachikitsa", department: DEPARTMENTS[1], hours: "Mon-Sat · 12:00 PM-4:00 PM", initials: "NP", tone: "pink" },
  { id: "shalya-01", username: "vikramsingh", name: "Dr. Vikram Singh", degree: "BAMS, MS (Ayurveda) - Shalya Tantra", department: DEPARTMENTS[2], hours: "Tue-Sun · 11:00 AM-4:00 PM", initials: "VS", tone: "blue" },
  { id: "shalya-02", username: "preetinaidu", name: "Dr. Preeti Naidu", degree: "BAMS, MS (Ayurveda) - Shalya Tantra", department: DEPARTMENTS[2], hours: "Mon-Fri · 8:00 AM-1:00 PM", initials: "PN", tone: "mint" },
  { id: "shalya-03", username: "karanmehra", name: "Dr. Karan Mehra", degree: "BAMS, MS (Ayurveda) - Shalya Tantra", department: DEPARTMENTS[2], hours: "Mon-Sat · 2:00 PM-6:00 PM", initials: "KM", tone: "coral" },
  { id: "shalya-04", username: "manojkulkarni", name: "Dr. Manoj Kulkarni", degree: "BAMS, MS (Ayurveda) - Shalya Tantra", department: DEPARTMENTS[2], hours: "Tue-Sat · 9:30 AM-2:30 PM", initials: "MK", tone: "slate" },
  { id: "shalya-05", username: "anitadey", name: "Dr. Anita Dey", degree: "BAMS, MS (Ayurveda) - Shalya Tantra", department: DEPARTMENTS[2], hours: "Mon-Fri · 4:00 PM-8:00 PM", initials: "AD", tone: "rose" },
  { id: "stri-01", username: "farahkhan", name: "Dr. Farah Khan", degree: "BAMS, MS (Ayurveda) - Prasuti Tantra & Stri Roga", department: DEPARTMENTS[3], hours: "Mon-Sat · 9:00 AM-1:00 PM", initials: "FK", tone: "pink" },
  { id: "stri-02", username: "nandinisen", name: "Dr. Nandini Sen", degree: "BAMS, MS (Ayurveda) - Prasuti Tantra & Stri Roga", department: DEPARTMENTS[3], hours: "Mon-Fri · 1:00 PM-5:00 PM", initials: "NS", tone: "violet" },
  { id: "stri-03", username: "priyamenon", name: "Dr. Priya Menon", degree: "BAMS, MS (Ayurveda) - Prasuti Tantra & Stri Roga", department: DEPARTMENTS[3], hours: "Tue-Sun · 9:00 AM-2:00 PM", initials: "PM", tone: "rose" },
  { id: "stri-04", username: "riyakapoor", name: "Dr. Riya Kapoor", degree: "BAMS, MS (Ayurveda) - Prasuti Tantra & Stri Roga", department: DEPARTMENTS[3], hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "RK", tone: "coral" },
  { id: "stri-05", username: "lakshmiiyer", name: "Dr. Lakshmi Iyer", degree: "BAMS, PhD - Prasuti Tantra & Stri Roga", department: DEPARTMENTS[3], hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "LI", tone: "teal" },
  { id: "shalakya-01", username: "ayeshajoseph", name: "Dr. Ayesha Joseph", degree: "BAMS, MS (Ayurveda) - Shalakya Tantra", department: DEPARTMENTS[4], hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "AJ", tone: "cyan" },
  { id: "shalakya-02", username: "sandeepnair", name: "Dr. Sandeep Nair", degree: "BAMS, MS (Ayurveda) - Shalakya Tantra", department: DEPARTMENTS[4], hours: "Mon-Sat · 9:00 AM-2:00 PM", initials: "SN", tone: "blue" },
  { id: "shalakya-03", username: "ishanverma", name: "Dr. Ishan Verma", degree: "BAMS, MS (Ayurveda) - Shalakya Tantra", department: DEPARTMENTS[4], hours: "Tue-Sun · 8:00 AM-1:00 PM", initials: "IV", tone: "violet" },
  { id: "shalakya-04", username: "kavitarao", name: "Dr. Kavita Rao", degree: "BAMS, MS (Ayurveda) - Shalakya Tantra", department: DEPARTMENTS[4], hours: "Mon-Fri · 2:00 PM-6:00 PM", initials: "KR", tone: "mint" },
  { id: "shalakya-05", username: "neelshah", name: "Dr. Neel Shah", degree: "BAMS, MS (Ayurveda) - Shalakya Tantra", department: DEPARTMENTS[4], hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "NS", tone: "slate" },
  { id: "bala-01", username: "aditirao", name: "Dr. Aditi Rao", degree: "BAMS, MD (Ayurveda) - Kaumarabhritya", department: DEPARTMENTS[5], hours: "Mon-Sat · 8:30 AM-1:00 PM", initials: "AR", tone: "sun" },
  { id: "bala-02", username: "rahulbhat", name: "Dr. Rahul Bhat", degree: "BAMS, MD (Ayurveda) - Kaumarabhritya", department: DEPARTMENTS[5], hours: "Mon-Fri · 1:00 PM-5:30 PM", initials: "RB", tone: "blue" },
  { id: "bala-03", username: "divyamenon", name: "Dr. Divya Menon", degree: "BAMS, MD (Ayurveda) - Bala Roga", department: DEPARTMENTS[5], hours: "Tue-Sun · 9:00 AM-2:00 PM", initials: "DM", tone: "rose" },
  { id: "bala-04", username: "akashjain", name: "Dr. Akash Jain", degree: "BAMS, MD (Ayurveda) - Kaumarabhritya", department: DEPARTMENTS[5], hours: "Mon-Sat · 2:00 PM-6:00 PM", initials: "AJ", tone: "mint" },
  { id: "bala-05", username: "shreyaiyer", name: "Dr. Shreya Iyer", degree: "BAMS, PhD - Kaumarabhritya", department: DEPARTMENTS[5], hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "SI", tone: "violet" },
  { id: "panchakarma-01", username: "naveenpatil", name: "Dr. Naveen Patil", degree: "BAMS, MD (Ayurveda) - Panchakarma", department: DEPARTMENTS[6], hours: "Mon-Sat · 7:30 AM-12:30 PM", initials: "NP", tone: "teal" },
  { id: "panchakarma-02", username: "sonalikulkarni", name: "Dr. Sonali Kulkarni", degree: "BAMS, MD (Ayurveda) - Panchakarma", department: DEPARTMENTS[6], hours: "Mon-Fri · 12:00 PM-5:00 PM", initials: "SK", tone: "rose" },
  { id: "panchakarma-03", username: "harishnair", name: "Dr. Harish Nair", degree: "BAMS, MD (Ayurveda) - Panchakarma, Rehabilitation", department: DEPARTMENTS[6], hours: "Tue-Sun · 8:00 AM-1:00 PM", initials: "HN", tone: "cyan" },
  { id: "panchakarma-04", username: "minaldesai", name: "Dr. Minal Desai", degree: "BAMS, MD (Ayurveda) - Panchakarma", department: DEPARTMENTS[6], hours: "Mon-Sat · 2:30 PM-6:30 PM", initials: "MD", tone: "mint" },
  { id: "panchakarma-05", username: "omprakashrao", name: "Dr. Omprakash Rao", degree: "BAMS, PhD - Panchakarma", department: DEPARTMENTS[6], hours: "Mon-Fri · 9:00 AM-3:00 PM", initials: "OR", tone: "slate" },
  { id: "swastha-01", username: "anjaliverma", name: "Dr. Anjali Verma", degree: "BAMS, MD (Ayurveda) - Swasthavritta & Yoga", department: DEPARTMENTS[7], hours: "Mon-Sat · 7:00 AM-12:00 PM", initials: "AV", tone: "mint" },
  { id: "swastha-02", username: "deepakmishra", name: "Dr. Deepak Mishra", degree: "BAMS, MD (Ayurveda) - Swasthavritta", department: DEPARTMENTS[7], hours: "Mon-Fri · 1:00 PM-6:00 PM", initials: "DM", tone: "blue" },
  { id: "swastha-03", username: "pallavisen", name: "Dr. Pallavi Sen", degree: "BAMS, MSc Yoga - Preventive Care", department: DEPARTMENTS[7], hours: "Tue-Sun · 8:30 AM-1:30 PM", initials: "PS", tone: "sun" },
  { id: "swastha-04", username: "vivekrana", name: "Dr. Vivek Rana", degree: "BAMS, MD (Ayurveda) - Swasthavritta", department: DEPARTMENTS[7], hours: "Mon-Sat · 3:00 PM-7:00 PM", initials: "VR", tone: "teal" },
  { id: "swastha-05", username: "jyotipillai", name: "Dr. Jyoti Pillai", degree: "BAMS, PhD - Swasthavritta & Yoga", department: DEPARTMENTS[7], hours: "Mon-Fri · 10:00 AM-4:00 PM", initials: "JP", tone: "violet" },
  { id: "manasa-01", username: "arunalal", name: "Dr. Aruna Lal", degree: "BAMS, MD (Ayurveda) - Manasa Roga", department: DEPARTMENTS[8], hours: "Mon-Sat · 9:00 AM-2:00 PM", initials: "AL", tone: "violet" },
  { id: "manasa-02", username: "siddharthjoshi", name: "Dr. Siddharth Joshi", degree: "BAMS, MD (Ayurveda) - Kayachikitsa, Manasa Roga", department: DEPARTMENTS[8], hours: "Mon-Fri · 2:00 PM-7:00 PM", initials: "SJ", tone: "blue" },
  { id: "manasa-03", username: "ritushah", name: "Dr. Ritu Shah", degree: "BAMS, MSc Psychology - Manasa Roga", department: DEPARTMENTS[8], hours: "Tue-Sun · 10:00 AM-3:00 PM", initials: "RS", tone: "rose" },
  { id: "manasa-04", username: "manavkapoor", name: "Dr. Manav Kapoor", degree: "BAMS, MD (Ayurveda) - Manasa Roga", department: DEPARTMENTS[8], hours: "Mon-Sat · 8:00 AM-1:00 PM", initials: "MK", tone: "cyan" },
  { id: "manasa-05", username: "leelakrishnan", name: "Dr. Leela Krishnan", degree: "BAMS, PhD - Manasa Roga & Yoga", department: DEPARTMENTS[8], hours: "Mon-Fri · 1:00 PM-5:00 PM", initials: "LK", tone: "teal" },
];

// One verified demo Vaidya for each of the nine supported departments.
const ACTIVE_DOCTOR_IDS = new Set([
  "kaya-01", "twacha-01", "shalya-01", "stri-01", "shalakya-01",
  "bala-01", "panchakarma-01", "swastha-01", "manasa-01",
]);
export const DOCTORS: DoctorProfile[] = ALL_DOCTORS.filter((doctor) =>
  ACTIVE_DOCTOR_IDS.has(doctor.id),
);

export function doctorForUsername(username: string) {
  const normalized = username.toLowerCase();
  if (normalized === "doctor") return undefined;
  return DOCTORS.find((doctor) => doctor.username === normalized);
}

export function scopedDoctorId(username: string) {
  const normalized = username.toLowerCase();
  if (normalized === "doctor") return null;
  return doctorForUsername(normalized)?.id ?? `managed-${normalized}`;
}

export function doctorForId(id: string) {
  return DOCTORS.find((doctor) => doctor.id === id);
}
