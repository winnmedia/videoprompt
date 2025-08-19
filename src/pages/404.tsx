export default function Custom404() {
	return (
		<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
			<h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>페이지를 찾을 수 없습니다</h1>
			<p style={{ color: '#6b7280' }}>요청하신 경로가 존재하지 않습니다.</p>
		</div>
	);
}


