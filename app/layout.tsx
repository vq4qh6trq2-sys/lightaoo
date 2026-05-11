export const metadata = {
  title: 'LightAO - Matching CCTP/DPGF',
  description: 'Matche automatiquement ton CCTP avec ton DPGF'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
