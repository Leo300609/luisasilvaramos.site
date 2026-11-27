'use client'

import { useId, useState, type FormEvent } from 'react'

import { EVENT_TYPES, SERVICE_AREA } from '@/content/site'
import {
  composeContactMessage,
  formatBrazilianPhone,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormInput,
} from '@/lib/contact-form'
import { CONTACT, instagramUrl, whatsappLink } from '@/lib/contact'

import { Alert, CheckCircle, Instagram, Mail, MapPin, WhatsApp } from './icons'
import { Kicker } from './kicker'

type Field = keyof ContactFormInput

const EMPTY: Required<ContactFormInput> = {
  name: '',
  whatsapp: '',
  eventType: '',
  eventDate: '',
  message: '',
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="lsr-field-error">
      <Alert size={16} />
      {message}
    </p>
  )
}

export function Contact() {
  const uid = useId()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [sentLink, setSentLink] = useState<string | null>(null)

  const id = (field: Field) => `${uid}-${field}`
  const errId = (field: Field) => `${uid}-${field}-erro`
  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
    setSentLink(null)
  }
  const a11y = (field: Field) => ({
    id: id(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? errId(field) : undefined,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    // Honeypot: real people never fill this hidden field.
    if ((form.elements.namedItem('website') as HTMLInputElement | null)?.value) return

    const result = validateContactForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      const first = (Object.keys(result.errors) as Field[])[0]
      if (first) document.getElementById(id(first))?.focus()
      return
    }
    const link = whatsappLink(composeContactMessage(result.data))
    setSentLink(link)
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <section id="contato" className="lsr-section bg-cream" aria-labelledby="contato-title">
      <div className="lsr-container lsr-contact-grid">
        <div className="lsr-contact-copy lsr-reveal">
          <Kicker>Contato</Kicker>
          <h2 id="contato-title" className="lsr-h2">
            Vamos <span className="lsr-accent">conversar</span>
          </h2>
          <p className="lsr-lead">
            Preencha o formulário com os detalhes do seu evento e eu retorno com disponibilidade e
            valores.
          </p>

          <form
            className="lsr-form relative"
            onSubmit={onSubmit}
            noValidate
            aria-label="Formulário de contato"
          >
            <div className="lsr-honeypot" aria-hidden="true">
              <label htmlFor={`${uid}-website`}>Não preencha este campo</label>
              <input
                id={`${uid}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="lsr-field-group">
              <label htmlFor={id('name')}>Nome</label>
              <input
                {...a11y('name')}
                className="lsr-field"
                type="text"
                autoComplete="name"
                required
                maxLength={120}
                placeholder="Seu nome completo"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <FieldError id={errId('name')} message={errors.name} />
            </div>

            <div className="lsr-field-group">
              <label htmlFor={id('whatsapp')}>WhatsApp</label>
              <input
                {...a11y('whatsapp')}
                className="lsr-field"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                placeholder="(DDD) 00000-0000"
                value={values.whatsapp}
                onChange={(e) => set('whatsapp', formatBrazilianPhone(e.target.value))}
              />
              <FieldError id={errId('whatsapp')} message={errors.whatsapp} />
            </div>

            <div className="lsr-field-group">
              <label htmlFor={id('eventType')}>Tipo de evento</label>
              <select
                {...a11y('eventType')}
                className="lsr-field"
                required
                value={values.eventType}
                onChange={(e) => set('eventType', e.target.value)}
              >
                <option value="">Selecione</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <FieldError id={errId('eventType')} message={errors.eventType} />
            </div>

            <div className="lsr-field-group">
              <label htmlFor={id('eventDate')}>Data do evento</label>
              <input
                {...a11y('eventDate')}
                className="lsr-field"
                type="date"
                value={values.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
              />
              <FieldError id={errId('eventDate')} message={errors.eventDate} />
            </div>

            <div className="lsr-field-group is-wide">
              <label htmlFor={id('message')}>Mensagem</label>
              <textarea
                {...a11y('message')}
                className="lsr-field"
                rows={4}
                maxLength={1500}
                placeholder="Conte um pouco sobre o evento, horário e local"
                value={values.message}
                onChange={(e) => set('message', e.target.value)}
              />
              <FieldError id={errId('message')} message={errors.message} />
            </div>

            <div className="lsr-form-actions">
              <button type="submit" className="lsr-btn lsr-btn-gold">
                Enviar mensagem
              </button>
              <div role="status" aria-live="polite">
                {sentLink && (
                  <p className="lsr-form-status">
                    <CheckCircle size={20} />
                    <span>
                      Obrigada! Abrimos o WhatsApp com a sua mensagem pronta: é só tocar em enviar.
                      Não abriu?{' '}
                      <a href={sentLink} target="_blank" rel="noopener noreferrer">
                        Clique aqui
                      </a>
                      .
                    </span>
                  </p>
                )}
              </div>
            </div>
            <p className="lsr-form-note">
              Sua mensagem é enviada pelo WhatsApp da Luísa. Não guardamos esses dados no site.
            </p>
          </form>
        </div>

        <aside className="lsr-contact-aside lsr-reveal" aria-labelledby="fale-comigo">
          <h3 id="fale-comigo">Fale comigo</h3>
          <a
            className="lsr-contact-item"
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="lsr-contact-item-icon" aria-hidden="true">
              <WhatsApp size={22} strokeWidth={1.3} />
            </span>
            <span>
              <small>WhatsApp</small>
              <strong>{CONTACT.whatsappDisplay}</strong>
            </span>
          </a>
          {CONTACT.instagramHandle && (
            <a
              className="lsr-contact-item"
              href={instagramUrl(CONTACT.instagramHandle)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="lsr-contact-item-icon" aria-hidden="true">
                <Instagram size={22} strokeWidth={1.3} />
              </span>
              <span>
                <small>Instagram</small>
                <strong>{CONTACT.instagramHandle}</strong>
              </span>
            </a>
          )}
          <a className="lsr-contact-item" href={`mailto:${CONTACT.email}`}>
            <span className="lsr-contact-item-icon" aria-hidden="true">
              <Mail size={22} strokeWidth={1.3} />
            </span>
            <span>
              <small>E-mail</small>
              <strong>{CONTACT.email}</strong>
            </span>
          </a>
          <div className="lsr-contact-item">
            <span className="lsr-contact-item-icon" aria-hidden="true">
              <MapPin size={22} strokeWidth={1.3} />
            </span>
            <span>
              <small>Atendimento</small>
              <strong>{SERVICE_AREA}</strong>
            </span>
          </div>
        </aside>
      </div>
    </section>
  )
}
