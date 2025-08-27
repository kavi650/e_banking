document.addEventListener('DOMContentLoaded', () => {
	const analyticsCanvas = document.getElementById('analyticsChart');
	if (analyticsCanvas) {
		const modeSelect = document.getElementById('analyticsMode');
		let chart;
		const loadData = async () => {
			const mode = modeSelect.value;
			const res = await fetch(`/admin/analytics/data?mode=${encodeURIComponent(mode)}`);
			const data = await res.json();
			const cfg = {
				type: 'bar',
				data: {
					labels: data.labels,
					datasets: data.datasets.map((d, i) => ({
						label: d.label,
						data: d.data,
						backgroundColor: ['#0053ba55','#00addb55','#7c3aed55'][i % 3],
						borderColor: ['#0053ba','#00addb','#7c3aed'][i % 3],
						borderWidth: 1
					}))
				},
				options: {responsive: true, scales: {y: {beginAtZero: true}}}
			};
			if (chart) chart.destroy();
			chart = new Chart(analyticsCanvas, cfg);
		};
		modeSelect.addEventListener('change', loadData);
		loadData();
	}

	const chatbotForm = document.getElementById('chatbotForm');
	if (chatbotForm) {
		chatbotForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const input = document.getElementById('chatInput');
			const log = document.getElementById('chatLog');
			const msg = input.value.trim();
			if (!msg) return;
			log.value += `You: ${msg}\n`;
			input.value = '';
			const res = await fetch('/customer/chatbot', {
				method: 'POST',
				headers: {'Content-Type': 'application/x-www-form-urlencoded'},
				body: new URLSearchParams({message: msg})
			});
			const data = await res.json();
			log.value += `Bot: ${data.reply}\n`;
			log.scrollTop = log.scrollHeight;
		});
	}
});