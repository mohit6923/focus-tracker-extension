document.addEventListener("DOMContentLoaded", function () {
    console.log("Analytics page loaded");
    
    const loadingMessage = document.getElementById("loadingMessage");
    const canvas = document.getElementById("analyticsChart");
    const errorMessage = document.getElementById("errorMessage");
    const chartContainer = document.getElementById("chartContainer");
    
    chrome.storage.local.get("focusSessionData", function (data) {
        console.log("Retrieved data:", data);
        
        const sessionData = data.focusSessionData;
        
        if (sessionData && Object.keys(sessionData).length > 0) {
            console.log("Session data found:", sessionData);
            
            const labels = Object.keys(sessionData);
            const values = Object.values(sessionData).map(v => v / 1000); // convert ms to seconds
            
            console.log("Labels:", labels);
            console.log("Values:", values);
            
            // Hide loading message and show canvas
            loadingMessage.style.display = "none";
            canvas.style.display = "block";
            
            console.log("Creating chart...");
            try {
                new Chart(canvas.getContext("2d"), {
                    type: "pie",
                    data: {
                        labels: labels,
                        datasets: [{
                            label: "Time Spent (seconds)",
                            data: values,
                            backgroundColor: [
                                "#FF6384",
                                "#36A2EB", 
                                "#FFCE56",
                                "#4BC0C0",
                                "#9966FF",
                                "#FF9F40"
                            ],
                            hoverBackgroundColor: [
                                "#FF6384",
                                "#36A2EB",
                                "#FFCE56", 
                                "#4BC0C0",
                                "#9966FF",
                                "#FF9F40"
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${label}: ${value.toFixed(1)}s (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
                console.log("Chart created successfully");
            } catch (error) {
                console.error("Error creating chart:", error);
                errorMessage.style.display = "block";
                errorMessage.innerHTML = "Error creating chart: " + error.message;
            }
        } else {
            console.log("No session data found");
            loadingMessage.style.display = "none";
            chartContainer.innerHTML = "<p style='text-align: center; color: #666;'>No data available for the last focus session. Start a focus session to see analytics here.</p>";
        }
    });
});
