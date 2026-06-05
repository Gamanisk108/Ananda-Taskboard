"""Signed, stateless email-verification tokens.

Reuses Django's PasswordResetTokenGenerator machinery (no DB table) but with a
distinct key_salt so a verification token can never be replayed as a password
reset token, or vice versa. Same PASSWORD_RESET_TIMEOUT window applies.
"""

from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "accounts.tokens.EmailVerificationTokenGenerator"


email_verification_token = EmailVerificationTokenGenerator()
