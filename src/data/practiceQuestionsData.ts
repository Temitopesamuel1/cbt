export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface PracticeSubjectMeta {
  name: string;
  code: string;
  topics: string[];
  description: string;
  iconName: string;
}

export const PRACTICE_SUBJECTS: PracticeSubjectMeta[] = [
  {
    name: 'Mathematics',
    code: 'MTH',
    description: 'Quadratic equations, algebra, trigonometry, logarithms, probability and calculus.',
    topics: ['All Topics', 'Quadratic Equations', 'Indices & Logarithms', 'Trigonometry', 'Statistics & Probability', 'Sequences & Series'],
    iconName: 'Calculator'
  },
  {
    name: 'English Language',
    code: 'ENG',
    description: 'Concord, grammatical structure, vocabulary, idioms, and sentence interpretation.',
    topics: ['All Topics', 'Concord & Syntax', 'Lexis & Vocabulary', 'Idiomatic Expressions', 'Sentence Correction'],
    iconName: 'BookA'
  },
  {
    name: 'Physics',
    code: 'PHY',
    description: 'Mechanics, motion, work and energy, electricity, waves, and thermal physics.',
    topics: ['All Topics', 'Mechanics & Motion', 'Work, Energy & Power', 'Electric Circuits', 'Waves & Optics', 'Thermal Physics'],
    iconName: 'Zap'
  },
  {
    name: 'Chemistry',
    code: 'CHM',
    description: 'Atomic structure, chemical bonding, acids, bases, salts, stoichiometry and organic chemistry.',
    topics: ['All Topics', 'Chemical Bonding', 'Acids, Bases & Salts', 'Organic Chemistry', 'Stoichiometry & Moles', 'Periodic Table'],
    iconName: 'FlaskConical'
  },
  {
    name: 'Biology',
    code: 'BIO',
    description: 'Cell biology, genetics, human anatomy, ecology, physiology, and evolutionary adaptations.',
    topics: ['All Topics', 'Cell Structure & Function', 'Genetics & Heredity', 'Nutrition & Digestion', 'Ecology & Environment', 'Circulatory System'],
    iconName: 'Dna'
  },
  {
    name: 'Computer Studies',
    code: 'CSC',
    description: 'Computer hardware, system software, networking, internet, algorithms, and cybersecurity.',
    topics: ['All Topics', 'Computer Architecture', 'Computer Networks & Internet', 'Algorithms & Logic', 'Cybersecurity & Ethics', 'Database Concepts'],
    iconName: 'Cpu'
  },
  {
    name: 'Economics',
    code: 'ECO',
    description: 'Microeconomics, price theory, consumer behavior, market structures, money, and banking.',
    topics: ['All Topics', 'Demand & Supply', 'Elasticity of Demand', 'Market Structures', 'Money & Banking', 'National Income'],
    iconName: 'TrendingUp'
  }
];

export const PRACTICE_QUESTION_BANK: PracticeQuestion[] = [
  // --- MATHEMATICS ---
  {
    id: 'pq-mth-001',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    text: 'What are the roots of the quadratic equation: 2x² - 5x + 2 = 0?',
    optionA: 'x = 2 and x = 1/2',
    optionB: 'x = -2 and x = -1/2',
    optionC: 'x = 4 and x = 1',
    optionD: 'x = -1 and x = 5/2',
    correctOption: 'A',
    explanation: 'Using the quadratic formula x = [-b ± √(b² - 4ac)] / (2a) where a=2, b=-5, c=2. The discriminant is (-5)² - 4(2)(2) = 25 - 16 = 9. Thus, x = [5 ± 3] / 4. Therefore x = 8/4 = 2 or x = 2/4 = 1/2.'
  },
  {
    id: 'pq-mth-002',
    subject: 'Mathematics',
    topic: 'Indices & Logarithms',
    text: 'If log₁₀(x) + log₁₀(4) = 2, determine the value of x.',
    optionA: 'x = 20',
    optionB: 'x = 25',
    optionC: 'x = 50',
    optionD: 'x = 200',
    correctOption: 'B',
    explanation: 'By the product law of logarithms: log₁₀(4x) = 2. Converting to exponential form: 4x = 10² = 100. Dividing both sides by 4 gives x = 25.'
  },
  {
    id: 'pq-mth-003',
    subject: 'Mathematics',
    topic: 'Trigonometry',
    text: 'If sin θ = 3/5 and θ is an acute angle, find the value of tan θ.',
    optionA: '3/4',
    optionB: '4/3',
    optionC: '4/5',
    optionD: '5/3',
    correctOption: 'A',
    explanation: 'In a right-angled triangle with opposite = 3 and hypotenuse = 5, the adjacent side is √(5² - 3²) = √(25 - 9) = √16 = 4. Hence, tan θ = Opposite / Adjacent = 3/4.'
  },
  {
    id: 'pq-mth-004',
    subject: 'Mathematics',
    topic: 'Statistics & Probability',
    text: 'A bag contains 5 red balls, 3 blue balls, and 2 green balls. What is the probability of picking a blue ball at random?',
    optionA: '1/5',
    optionB: '3/10',
    optionC: '1/3',
    optionD: '1/2',
    correctOption: 'B',
    explanation: 'Total number of balls = 5 + 3 + 2 = 10 balls. The number of blue balls = 3. Therefore, P(Blue) = 3/10 = 0.30.'
  },
  {
    id: 'pq-mth-005',
    subject: 'Mathematics',
    topic: 'Sequences & Series',
    text: 'Find the 10th term of the arithmetic progression: 3, 7, 11, 15, ...',
    optionA: '36',
    optionB: '39',
    optionC: '43',
    optionD: '47',
    correctOption: 'B',
    explanation: 'First term a = 3, common difference d = 7 - 3 = 4. The nth term formula is Tₙ = a + (n - 1)d. For n = 10: T₁₀ = 3 + (10 - 1) × 4 = 3 + 36 = 39.'
  },
  {
    id: 'pq-mth-006',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    text: 'For what value of k will the equation x² + 6x + k = 0 have equal roots?',
    optionA: 'k = 3',
    optionB: 'k = 6',
    optionC: 'k = 9',
    optionD: 'k = 12',
    correctOption: 'C',
    explanation: 'For a quadratic equation to have equal (repeated) roots, its discriminant must equal zero: b² - 4ac = 0. Here a=1, b=6, c=k. 6² - 4(1)(k) = 0 => 36 - 4k = 0 => 4k = 36 => k = 9.'
  },

  // --- ENGLISH LANGUAGE ---
  {
    id: 'pq-eng-001',
    subject: 'English Language',
    topic: 'Concord & Syntax',
    text: 'Choose the correct option: "Neither the principal nor the teachers _____ in attendance at the emergency briefing yesterday."',
    optionA: 'was',
    optionB: 'were',
    optionC: 'is',
    optionD: 'are',
    correctOption: 'B',
    explanation: 'According to the rule of proximity in grammatical concord, when subjects are joined by "neither... nor", the verb agrees in number with the nearer subject. Here "teachers" is plural, and the tense is past ("yesterday"), hence "were".'
  },
  {
    id: 'pq-eng-002',
    subject: 'English Language',
    topic: 'Lexis & Vocabulary',
    text: 'Select the word that is nearest in meaning to EPHEMERAL in the sentence: "The candidate enjoyed ephemeral popularity before the scandal broke."',
    optionA: 'Transient',
    optionB: 'Enduring',
    optionC: 'Immense',
    optionD: 'Doubtful',
    correctOption: 'A',
    explanation: 'Ephemeral means lasting for a very short time, brief, or fleeting. Transient is an exact synonym denoting something momentary.'
  },
  {
    id: 'pq-eng-003',
    subject: 'English Language',
    topic: 'Idiomatic Expressions',
    text: 'What does the idiom "burn the midnight oil" mean?',
    optionA: 'To waste fuel recklessly',
    optionB: 'To study or work late into the night',
    optionC: 'To cause an accidental domestic fire',
    optionD: 'To celebrate until dawn',
    correctOption: 'B',
    explanation: '"Burning the midnight oil" refers to working, writing, or studying diligently late into the night.'
  },
  {
    id: 'pq-eng-004',
    subject: 'English Language',
    topic: 'Sentence Correction',
    text: 'Identify the sentence with correct punctuation and syntax:',
    optionA: 'Having finished his exams, the holiday began immediately.',
    optionB: 'Having finished his exams, Chidi immediately embarked on his holiday.',
    optionC: 'Chidi having finished his exams the holiday began.',
    optionD: 'Having finish his exams Chidi began a holiday.',
    correctOption: 'B',
    explanation: 'Sentence A contains a dangling participle because "the holiday" did not finish the exams. In sentence B, the participatory clause "Having finished his exams" logically and grammatically modifies "Chidi".'
  },
  {
    id: 'pq-eng-005',
    subject: 'English Language',
    topic: 'Concord & Syntax',
    text: 'Select the grammatically correct completion: "The committee _____ reached a unanimous verdict."',
    optionA: 'has',
    optionB: 'have',
    optionC: 'are',
    optionD: 'were',
    correctOption: 'A',
    explanation: 'When a collective noun like "committee" acts as a single unified body with unanimous agreement, it takes a singular verb: "has reached".'
  },

  // --- PHYSICS ---
  {
    id: 'pq-phy-001',
    subject: 'Physics',
    topic: 'Mechanics & Motion',
    text: 'A car accelerates uniformly from rest to a speed of 20 m/s in 5 seconds. What is the total distance covered by the car?',
    optionA: '25 m',
    optionB: '50 m',
    optionC: '100 m',
    optionD: '200 m',
    correctOption: 'B',
    explanation: 'Initial velocity u = 0, final velocity v = 20 m/s, time t = 5 s. Using the equation of motion s = ((u + v) / 2) * t = ((0 + 20) / 2) * 5 = 10 * 5 = 50 meters.'
  },
  {
    id: 'pq-phy-002',
    subject: 'Physics',
    topic: 'Electric Circuits',
    text: 'Three resistors of resistance 2 Ω, 3 Ω, and 6 Ω are connected in parallel. What is their equivalent resistance?',
    optionA: '1 Ω',
    optionB: '2 Ω',
    optionC: '6 Ω',
    optionD: '11 Ω',
    correctOption: 'A',
    explanation: 'For parallel resistors: 1/R = 1/2 + 1/3 + 1/6 = 3/6 + 2/6 + 1/6 = 6/6 = 1. Therefore, R = 1 Ω.'
  },
  {
    id: 'pq-phy-003',
    subject: 'Physics',
    topic: 'Work, Energy & Power',
    text: 'Calculate the kinetic energy of a 2 kg object moving with a uniform velocity of 6 m/s.',
    optionA: '12 J',
    optionB: '24 J',
    optionC: '36 J',
    optionD: '72 J',
    correctOption: 'C',
    explanation: 'Kinetic energy KE = 1/2 m v² = 1/2 * 2 kg * (6 m/s)² = 1 * 36 = 36 Joules.'
  },
  {
    id: 'pq-phy-004',
    subject: 'Physics',
    topic: 'Waves & Optics',
    text: 'Which phenomenon provides conclusive evidence that light is a transverse wave rather than a longitudinal wave?',
    optionA: 'Refraction',
    optionB: 'Diffraction',
    optionC: 'Interference',
    optionD: 'Polarization',
    correctOption: 'D',
    explanation: 'Polarization is the only wave property unique to transverse waves. Longitudinal waves (like sound waves) cannot be polarized because their oscillations are parallel to the direction of propagation.'
  },

  // --- CHEMISTRY ---
  {
    id: 'pq-chm-001',
    subject: 'Chemistry',
    topic: 'Acids, Bases & Salts',
    text: 'What is the pH of a 0.001 mol/dm³ aqueous solution of hydrochloric acid (HCl)?',
    optionA: '1',
    optionB: '2',
    optionC: '3',
    optionD: '4',
    correctOption: 'C',
    explanation: 'HCl is a strong monoprotic acid that dissociates completely: [H⁺] = 0.001 M = 10⁻³ M. The pH is defined as -log₁₀[H⁺] = -log₁₀(10⁻³) = 3.'
  },
  {
    id: 'pq-chm-002',
    subject: 'Chemistry',
    topic: 'Organic Chemistry',
    text: 'Which general molecular formula represents the homologous series of alkanes?',
    optionA: 'CₙH₂ₙ₊₂',
    optionB: 'CₙH₂ₙ',
    optionC: 'CₙH₂ₙ₋₂',
    optionD: 'CₙH₂ₙ₋₆',
    correctOption: 'A',
    explanation: 'Alkanes are saturated aliphatic hydrocarbons having single covalent bonds with general formula CₙH₂ₙ₊₂ (e.g., Methane CH₄, Ethane C₂H₆).'
  },
  {
    id: 'pq-chm-003',
    subject: 'Chemistry',
    topic: 'Chemical Bonding',
    text: 'Which type of chemical bond is formed when electrons are transferred completely from a metal atom to a non-metal atom?',
    optionA: 'Covalent bond',
    optionB: 'Electrovalent (ionic) bond',
    optionC: 'Dative bond',
    optionD: 'Metallic bond',
    correctOption: 'B',
    explanation: 'An electrovalent or ionic bond is formed by the complete electrostatic transfer of one or more valence electrons from an electropositive metallic element to an electronegative non-metal.'
  },
  {
    id: 'pq-chm-004',
    subject: 'Chemistry',
    topic: 'Stoichiometry & Moles',
    text: 'How many moles are present in 44 grams of Carbon Dioxide (CO₂)? [Atomic masses: C = 12, O = 16]',
    optionA: '0.5 mol',
    optionB: '1.0 mol',
    optionC: '2.0 mol',
    optionD: '4.0 mol',
    correctOption: 'B',
    explanation: 'Molar mass of CO₂ = 12 + (2 × 16) = 12 + 32 = 44 g/mol. Number of moles = mass / molar mass = 44 g / 44 g/mol = 1.0 mole.'
  },

  // --- BIOLOGY ---
  {
    id: 'pq-bio-001',
    subject: 'Biology',
    topic: 'Cell Structure & Function',
    text: 'Which organelle is known as the "powerhouse of the cell" due to its generation of adenosine triphosphate (ATP)?',
    optionA: 'Ribosome',
    optionB: 'Golgi apparatus',
    optionC: 'Mitochondrion',
    optionD: 'Endoplasmic reticulum',
    correctOption: 'C',
    explanation: 'The mitochondrion carries out aerobic cellular respiration (Krebs cycle and oxidative phosphorylation), synthesizing the bulk of the cell\'s ATP.'
  },
  {
    id: 'pq-bio-002',
    subject: 'Biology',
    topic: 'Genetics & Heredity',
    text: 'In Mendelian monohybrid inheritance, what phenotypic ratio is expected in the F2 generation resulting from heterozygous parents (Tt × Tt)?',
    optionA: '1:1',
    optionB: '2:1',
    optionC: '3:1',
    optionD: '9:3:3:1',
    correctOption: 'C',
    explanation: 'Crossing Tt × Tt yields genotypes 1 TT, 2 Tt, 1 tt. The dominant phenotype (TT and Tt) constitutes 3 parts and the recessive (tt) constitutes 1 part, yielding a 3:1 phenotypic ratio.'
  },
  {
    id: 'pq-bio-003',
    subject: 'Biology',
    topic: 'Circulatory System',
    text: 'Which blood vessels carry oxygenated blood from the lungs directly into the left atrium of the human heart?',
    optionA: 'Pulmonary veins',
    optionB: 'Pulmonary arteries',
    optionC: 'Vena cava',
    optionD: 'Aorta',
    correctOption: 'A',
    explanation: 'The pulmonary veins are unique among veins because they transport freshly oxygenated blood from the alveolar capillaries of the lungs into the left atrium.'
  },

  // --- COMPUTER STUDIES ---
  {
    id: 'pq-csc-001',
    subject: 'Computer Studies',
    topic: 'Computer Architecture',
    text: 'What component inside the Central Processing Unit (CPU) holds data and instructions temporarily during arithmetic operations?',
    optionA: 'Control Unit (CU)',
    optionB: 'Arithmetic Logic Unit (ALU)',
    optionC: 'Internal Registers',
    optionD: 'System Bus',
    correctOption: 'C',
    explanation: 'Registers are ultra-fast, small temporary memory storage units directly integrated into the CPU used to hold immediate operands, memory addresses, and accumulator values.'
  },
  {
    id: 'pq-csc-002',
    subject: 'Computer Studies',
    topic: 'Computer Networks & Internet',
    text: 'Which protocol is responsible for securely transmitting encrypted web pages between a client browser and a web server?',
    optionA: 'HTTP',
    optionB: 'FTP',
    optionC: 'HTTPS',
    optionD: 'SMTP',
    correctOption: 'C',
    explanation: 'HTTPS (HyperText Transfer Protocol Secure) uses TLS/SSL encryption to secure communication and prevent eavesdropping or tampering over the network.'
  },
  {
    id: 'pq-csc-003',
    subject: 'Computer Studies',
    topic: 'Cybersecurity & Ethics',
    text: 'Which malicious software masquerades as legitimate software but performs unauthorized operations once installed?',
    optionA: 'Computer Worm',
    optionB: 'Trojan Horse',
    optionC: 'Spyware',
    optionD: 'Adware',
    correctOption: 'B',
    explanation: 'A Trojan Horse is named after the Greek myth; it disguises itself as benign, helpful software to deceive users into executing it, where it then drops unauthorized payloads.'
  },

  // --- ECONOMICS ---
  {
    id: 'pq-eco-001',
    subject: 'Economics',
    topic: 'Demand & Supply',
    text: 'According to the basic Law of Demand, what happens when the price of a normal good increases, ceteris paribus?',
    optionA: 'Quantity demanded increases',
    optionB: 'Quantity demanded decreases',
    optionC: 'Supply curve shifts to the left',
    optionD: 'Total utility increases',
    correctOption: 'B',
    explanation: 'The Law of Demand states that an inverse relationship exists between the price of a good and the quantity demanded, assuming all other factors remain constant (ceteris paribus).'
  },
  {
    id: 'pq-eco-002',
    subject: 'Economics',
    topic: 'Market Structures',
    text: 'A market structure characterized by a single seller supplying a unique product with high barriers to entry is known as a:',
    optionA: 'Monopoly',
    optionB: 'Oligopoly',
    optionC: 'Monopolistic competition',
    optionD: 'Perfect competition',
    correctOption: 'A',
    explanation: 'A monopoly exists when a single firm is the sole producer of a product with no close substitutes, protected by formidable barriers to entry.'
  }
];
