export type MentalHealthProvider = {
  id: string;
  name: string;
  role: string;
  specialization: string;
  city: string;
  location: string;
  address: string;
  phone?: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const PAKISTAN_MENTAL_HEALTH_DIRECTORY: MentalHealthProvider[] = [
  {
    id: "shifa-mehboob-yaqub",
    name: "Dr. Mehboob Yaqub",
    role: "Consultant psychiatrist",
    specialization: "Psychiatry",
    city: "Islamabad",
    location: "Shifa International Hospital",
    address: "Pitras Bukhari Road, H-8/4, Islamabad",
    sourceLabel: "Shifa International Hospitals",
    sourceUrl: "https://www.shifa.com.pk/doctors/dr-mehboob-yaqub",
  },
  {
    id: "lgh-faiza-athar",
    name: "Dr. Faiza Athar",
    role: "Head of Psychiatry Department",
    specialization: "Psychiatry",
    city: "Lahore",
    location: "Lahore General Hospital",
    address: "Ferozepur Road, Lahore",
    sourceLabel: "Lahore General Hospital",
    sourceUrl: "https://lgh.punjab.gov.pk/dept_psychiatry",
  },
  {
    id: "lgh-asma-gull",
    name: "Dr. Asma Gull",
    role: "Senior psychologist",
    specialization: "Clinical psychology",
    city: "Lahore",
    location: "Lahore General Hospital",
    address: "Ferozepur Road, Lahore",
    sourceLabel: "Lahore General Hospital",
    sourceUrl: "https://lgh.punjab.gov.pk/dept_psychiatry",
  },
  {
    id: "aku-hadia-pasha",
    name: "Dr. Hadia Pasha",
    role: "Clinical psychologist",
    specialization: "Student wellness and counselling",
    city: "Karachi",
    location: "Aga Khan University",
    address: "Stadium Road, Karachi",
    sourceLabel: "Aga Khan University",
    sourceUrl: "https://www.aku.edu/students/wellness/pk/about/Pages/our-team.aspx",
  },
  {
    id: "aku-psychiatry",
    name: "AKUH Department of Psychiatry",
    role: "Hospital psychiatry service",
    specialization: "Psychiatry and mental health services",
    city: "Karachi",
    location: "Aga Khan University Hospital",
    address: "Stadium Road, Karachi",
    sourceLabel: "Aga Khan University Hospital",
    sourceUrl: "https://hospitals.aku.edu/pakistan/Health-Services/department-of-psychiatry/Pages/default.aspx",
  },
  {
    id: "taskeen-health",
    name: "Taskeen Health Initiative",
    role: "Mental health support service",
    specialization: "Helpline and mental health awareness",
    city: "Karachi",
    location: "Taskeen Mental Health",
    address: "Karachi, Pakistan",
    phone: "+92 316 8275336",
    sourceLabel: "Taskeen",
    sourceUrl: "https://taskeen.org/program/mental-health-helpline/",
  },
  {
    id: "umang-pakistan",
    name: "Umang Pakistan",
    role: "Mental health helpline",
    specialization: "Crisis listening and counselling support",
    city: "Lahore",
    location: "Umang Pakistan",
    address: "Lahore, Pakistan",
    phone: "0311 7786264",
    sourceLabel: "Umang Pakistan",
    sourceUrl: "https://umang.com.pk/",
  },
  {
    id: "rozan-islamabad",
    name: "Rozan",
    role: "Counselling and psychosocial support",
    specialization: "Emotional health, violence prevention, and support",
    city: "Islamabad",
    location: "Rozan",
    address: "Pind Bhagwal Road, Islamabad 44000, Pakistan",
    sourceLabel: "Rozan",
    sourceUrl: "https://rozan.org/counseling-services/",
  },
  {
    id: "fountain-house-lahore",
    name: "Fountain House Lahore",
    role: "Mental health rehabilitation service",
    specialization: "Psychiatric rehabilitation and community support",
    city: "Lahore",
    location: "Fountain House",
    address: "Lahore, Pakistan",
    sourceLabel: "Fountain House",
    sourceUrl: "https://www.fountainhouse.com.pk/index.html",
  },
];

export const DIRECTORY_CITIES = ["All", ...Array.from(new Set(PAKISTAN_MENTAL_HEALTH_DIRECTORY.map((item) => item.city))).sort()];
