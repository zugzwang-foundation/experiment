// F-AUTH-2 OTP code entry per plan §4 page inventory. Server Component
// placeholder; DESIGN.* owns the visual treatment.

export default function OtpPage(): React.ReactElement {
	return (
		<main>
			<h1>Enter your verification code</h1>
			<p>Check your email for a 6-digit code.</p>
			<form action="/api/auth/email-otp/verify-email" method="post">
				<label>
					Email:
					<input type="email" name="email" required />
				</label>
				<label>
					Code:
					<input
						type="text"
						name="otp"
						inputMode="numeric"
						pattern="[0-9]{6}"
						maxLength={6}
						required
					/>
				</label>
				<button type="submit">Verify</button>
			</form>
		</main>
	);
}
