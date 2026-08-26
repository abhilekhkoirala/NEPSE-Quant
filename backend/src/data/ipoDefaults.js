// Illustrative IPO/FPO pipeline used only when neither a live scrape
// (scrape_ipo.py → ipo_data.json) nor a cached result is available.
// Moved verbatim from src/App.jsx (IPO_STATIC_DATA). Also used by the
// static/no-backend GitHub Pages deployment as its built-in fallback.
const IPO_STATIC_DATA = [
  { id:1,  company:"Arun Valley Hydropower Development Co.",  symbol:"AHPC",    sector:"Hydropower",        type:"Ordinary",  issuePrice:100,  totalShares:2400000,  publicShares:600000,  openDate:"2025-06-01", closeDate:"2025-06-05", status:"upcoming",   subscribed:null,  promoter:"Arun Valley Consortium" },
  { id:2,  company:"Himalayan Reinsurance Ltd.",              symbol:"HRL",     sector:"Non-Life Insurance",type:"Ordinary",  issuePrice:100,  totalShares:6500000,  publicShares:1300000, openDate:"2025-05-20", closeDate:"2025-05-24", status:"open",       subscribed:3.8,   promoter:"GoN / NIA Consortium" },
  { id:3,  company:"Purnima Microfinance Bittiya Sanstha",   symbol:"PMFBS",   sector:"Microfinance",      type:"Ordinary",  issuePrice:100,  totalShares:800000,   publicShares:200000,  openDate:"2025-05-15", closeDate:"2025-05-19", status:"allotment",  subscribed:28.4,  promoter:"Purnima Group" },
  { id:4,  company:"Solu Hydropower Ltd.",                   symbol:"SOLH",    sector:"Hydropower",        type:"Ordinary",  issuePrice:100,  totalShares:3000000,  publicShares:750000,  openDate:"2025-04-28", closeDate:"2025-05-02", status:"closed",     subscribed:11.2,  promoter:"Solu Khola Pvt. Ltd." },
  { id:5,  company:"Nepal Infrastructure Bank Ltd.",         symbol:"NIFRA",   sector:"Finance",           type:"FPO",       issuePrice:167,  totalShares:5000000,  publicShares:1000000, openDate:"2025-06-10", closeDate:"2025-06-14", status:"upcoming",   subscribed:null,  promoter:"GoN / MoF" },
  { id:6,  company:"Bheri Hydropower Co.",                   symbol:"BHERL",   sector:"Hydropower",        type:"Ordinary",  issuePrice:100,  totalShares:1600000,  publicShares:400000,  openDate:"2025-05-27", closeDate:"2025-05-31", status:"open",       subscribed:1.2,   promoter:"Bheri Basin Dev." },
  { id:7,  company:"Citizen Investment Trust",               symbol:"CIT",     sector:"Finance",           type:"Debenture", issuePrice:1000, totalShares:300000,   publicShares:300000,  openDate:"2025-06-03", closeDate:"2025-06-07", status:"upcoming",   subscribed:null,  promoter:"GoN" },
  { id:8,  company:"Sunrise First Mutual Fund",              symbol:"SFMF",    sector:"Mutual Fund",       type:"Ordinary",  issuePrice:10,   totalShares:50000000, publicShares:25000000,openDate:"2025-04-10", closeDate:"2025-04-14", status:"closed",     subscribed:4.3,   promoter:"Sunrise Capital" },
  { id:9,  company:"Jalpa Samudayik Laghubitta",             symbol:"JALPA",   sector:"Microfinance",      type:"Ordinary",  issuePrice:100,  totalShares:600000,   publicShares:150000,  openDate:"2025-06-16", closeDate:"2025-06-20", status:"upcoming",   subscribed:null,  promoter:"Jalpa Dev. Society" },
  { id:10, company:"Kumari Laghubitta Bittiya Sanstha",      symbol:"KLBSL",   sector:"Microfinance",      type:"Rights",    issuePrice:100,  totalShares:1000000,  publicShares:0,       openDate:"2025-05-22", closeDate:"2025-05-26", status:"open",       subscribed:0.6,   promoter:"Kumari Bank" },
];


export { IPO_STATIC_DATA };
