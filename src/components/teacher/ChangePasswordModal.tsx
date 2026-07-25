'use client'
import React, { useState } from 'react'
import { Loader2, CheckCircle2, Eye, EyeOff, Lock, AlertTriangle, X, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  isForced?: boolean
}

export default function ChangePasswordModal({ isOpen, onClose, isForced = false }: ChangePasswordModalProps) {
  const supabase = createClient()

  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPass.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPass !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPass,
      })

      if (updateErr) {
        setError(updateErr.message)
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', session.user.id)

        if (session.user.email) {
          await supabase
            .from('allowed_users')
            .update({ is_registered: true, must_change_password: false })
            .eq('email', session.user.email)
        }
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setNewPass('')
        setConfirm('')
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  const inputStyle = (isFocused: boolean): React.CSSProperties => ({
    width: '100%',
    height: '44px',
    padding: '0 40px 0 14px',
    borderRadius: '10px',
    border: `2px solid ${isFocused ? H.grass : H.border}`,
    backgroundColor: H.bg,
    fontSize: '14px',
    color: H.textPrimary,
    fontFamily: H.font,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isForced) {
          onClose()
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: H.surface,
          borderRadius: '20px',
          border: `1px solid ${H.border}`,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          fontFamily: H.font,
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${H.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: H.surface,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#D1FAE5',
                border: `1px solid ${H.grass}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyRound size={20} style={{ color: '#059669' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>
                {isForced ? 'Set Permanent Password' : 'Change Password'}
              </h2>
              <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>
                {isForced
                  ? 'Set a new password to secure your teacher account'
                  : 'Enter your new password below'}
              </p>
            </div>
          </div>
          {!isForced && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                color: H.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  backgroundColor: '#D1FAE5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: '0 0 6px' }}>
                Password Updated!
              </h3>
              <p style={{ fontSize: '13px', color: H.textSec, margin: 0 }}>
                Your account password has been updated successfully.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: H.dangerLight,
                    border: `1px solid ${H.danger}40`,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: H.danger,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: H.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '6px',
                  }}
                >
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    onFocus={() => setFocusedField('newPass')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="At least 8 characters"
                    style={inputStyle(focusedField === 'newPass')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: H.textMuted,
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: H.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '6px',
                  }}
                >
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="Repeat new password"
                    style={inputStyle(focusedField === 'confirm')}
                  />
                </div>
                {confirm && confirm !== newPass && (
                  <span style={{ fontSize: '11px', color: H.danger, marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                {!isForced && (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      border: `1px solid ${H.border}`,
                      borderRadius: '10px',
                      background: H.surface,
                      color: H.textSec,
                      fontWeight: 700,
                      fontSize: '13px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      minHeight: '42px',
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || newPass.length < 8 || newPass !== confirm}
                  style={{
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: H.grass,
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    minHeight: '42px',
                    flex: isForced ? 1 : undefined,
                    opacity: loading || newPass.length < 8 || newPass !== confirm ? 0.6 : 1,
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Save Password
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
