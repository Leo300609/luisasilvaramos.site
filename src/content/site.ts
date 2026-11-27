/**
 * Content of the public site, taken from the Claude Design canvas.
 *
 * Values between [brackets] are the design's own placeholders. They are pending
 * real information from the Luísa and MUST be replaced before go-live
 * (see docs/go-live-checklist.md). In Phase 5 this content becomes editable in
 * the admin panel (design gap L5).
 */

export type ServiceCard = {
  slug: 'social' | 'noiva' | 'formatura' | 'eventos'
  number: string
  title: string
  description: string
  icon: 'social' | 'noiva' | 'formatura' | 'eventos'
}

export const SERVICES: readonly ServiceCard[] = [
  {
    slug: 'social',
    number: '01',
    title: 'Maquiagem Social',
    description:
      'Para aniversários, jantares e encontros: uma make elegante que realça seus traços.',
    icon: 'social',
  },
  {
    slug: 'noiva',
    number: '02',
    title: 'Maquiagem para Noivas',
    description: 'Teste prévio e make à prova de emoção, para você brilhar do altar à pista.',
    icon: 'noiva',
  },
  {
    slug: 'formatura',
    number: '03',
    title: 'Maquiagem para Formaturas',
    description: 'Make marcante e fotogênica para celebrar a sua conquista com estilo.',
    icon: 'formatura',
  },
  {
    slug: 'eventos',
    number: '04',
    title: 'Maquiagem para Eventos e Festas',
    description: 'Do casamento da amiga à festa de fim de ano: pronta para qualquer ocasião.',
    icon: 'eventos',
  },
]

export const ABOUT_HIGHLIGHTS = [
  {
    icon: 'sparkle',
    title: 'Produtos de alta qualidade',
    text: 'Marcas profissionais, seguras e confortáveis na pele.',
  },
  {
    icon: 'person',
    title: 'Atendimento personalizado',
    text: 'Cada make pensada para o seu rosto e o seu estilo.',
  },
  {
    icon: 'clock',
    title: 'Make que dura o dia todo',
    text: 'Técnicas de preparação e fixação, sem retoques.',
  },
] as const

export const ABOUT_PARAGRAPHS = [
  'Sou a Luísa Silva Ramos, maquiadora profissional. Acredito que a maquiagem certa não esconde quem você é: ela realça a sua beleza natural e deixa você confiante para viver cada momento.',
  // TODO(Leo): texto real da trajetória da Luísa.
  '[Conte aqui a sua trajetória: há quanto tempo trabalha com maquiagem, cursos e especializações que fez e o que mais ama na profissão.]',
] as const

export const HERO_STATS = [
  // TODO(Leo): número real de clientes atendidas.
  { value: '+ de [X]', label: 'clientes atendidas' },
  // TODO(Leo): cidade-base de atendimento.
  { value: '[Cidade]', label: 'e região' },
] as const

export type PortfolioItem = {
  /** Category shown on the tile. Artística/Editorial and Aulas were removed (Phase 0, P5). */
  category: 'Noiva' | 'Social' | 'Formatura' | 'Festa'
  /** Placeholder background from the design, used until real photos exist. */
  tone: string
  /** Tile heights from the design: desktop and mobile. Tablet uses 78% of desktop. */
  heightDesktop: number
  heightMobile: number
  /** Real photo, when available (TODO(Leo): fotos com autorização de uso de imagem). */
  image?: { src: string; alt: string }
}

export const PORTFOLIO: readonly PortfolioItem[] = [
  { category: 'Noiva', tone: '#EFE1CB', heightDesktop: 360, heightMobile: 220 },
  { category: 'Social', tone: '#F6E7BF', heightDesktop: 260, heightMobile: 240 },
  { category: 'Formatura', tone: '#E9D6B8', heightDesktop: 300, heightMobile: 170 },
  { category: 'Festa', tone: '#F3E6D2', heightDesktop: 260, heightMobile: 250 },
  { category: 'Noiva', tone: '#F2E2B6', heightDesktop: 360, heightMobile: 200 },
  { category: 'Social', tone: '#EBDCC6', heightDesktop: 280, heightMobile: 230 },
  { category: 'Formatura', tone: '#F5E9CF', heightDesktop: 300, heightMobile: 170 },
  { category: 'Festa', tone: '#E6D2AF', heightDesktop: 300, heightMobile: 240 },
  { category: 'Noiva', tone: '#F0E0C0', heightDesktop: 340, heightMobile: 190 },
]

export const PROCESS_STEPS = [
  {
    title: 'Contato',
    text: 'Você me chama no WhatsApp e conta sobre o evento, a data e o local.',
  },
  {
    title: 'Escolha do look',
    text: 'Conversamos sobre referências, estilo e o look ideal para você.',
  },
  {
    title: 'Dia da make',
    text: 'Preparação da pele e maquiagem feitas com calma, no tempo certo.',
  },
  { title: 'Resultado', text: 'Você pronta, confiante e linda para viver o seu momento.' },
] as const

export type Testimonial = { quote: string; author: string; context: string }

// TODO(Leo): depoimentos reais, com autorização das clientes.
export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      '[Depoimento real da cliente: como foi o atendimento no dia do casamento e como ela se sentiu com a make.]',
    author: '[Nome da cliente]',
    context: 'Noiva · [mês/ano]',
  },
  {
    quote:
      '[Depoimento real da cliente: a make da formatura, a duração ao longo da noite e o resultado nas fotos.]',
    author: '[Nome da cliente]',
    context: 'Formatura · [mês/ano]',
  },
  {
    quote:
      '[Depoimento real da cliente: a make para a festa ou evento, o atendimento e o que mais gostou.]',
    author: '[Nome da cliente]',
    context: 'Festa · [mês/ano]',
  },
]

/** Event types offered in the contact form (Artística and Aulas removed, Phase 0 P5). */
export const EVENT_TYPES = ['Maquiagem social', 'Noiva', 'Formatura', 'Evento ou festa'] as const

// TODO(Leo): cidade / região de atendimento.
export const SERVICE_AREA = '[Cidade / região de atendimento]'

export const TAGLINE =
  'Maquiagem que valoriza o que você tem de mais bonito, para o seu dia mais especial.'
