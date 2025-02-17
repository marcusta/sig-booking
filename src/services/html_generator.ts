import type {
  BayUtilization,
  CustomerBookingSummary,
} from "./booking_analysis";

export function generateBookingSummaryHTML(
  data: {
    customerSummaries: CustomerBookingSummary[];
    bayUtilizations: BayUtilization[];
    totalBookings: number;
    totalBookingHours: number;
    totalPrimeHours: number;
    totalRegularHours: number;
    uniqueCustomers: number;
  },
  year: number,
  month: number
): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const openingHoursPerDay = 19;
  const totalAvailableHours = 8 * openingHoursPerDay * daysInMonth;
  const capacityUtilization =
    (data.totalBookingHours / totalAvailableHours) * 100;

  // Get month name
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monthly Booking Summary - ${monthName} ${year}</title>
        <style>
            body {
                font-family: sans-serif;
                padding: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .summary {
                margin-bottom: 20px;
                font-weight: bold;
            }
            .utilization-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .bay-card {
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 5px;
                background-color: #f8f9fa;
            }
        </style>
    </head>
    <body>
        <h1>Monthly Booking Summary - ${monthName} ${year}</h1>
        <div class="summary">
            Total Bookings: ${data.totalBookings}<br>
            Total Booking Hours: ${data.totalBookingHours.toFixed(2)}<br>
            Prime Time Hours: ${data.totalPrimeHours.toFixed(2)} (${(
    (data.totalPrimeHours / data.totalBookingHours) *
    100
  ).toFixed(1)}%)<br>
            Regular Hours: ${data.totalRegularHours.toFixed(2)} (${(
    (data.totalRegularHours / data.totalBookingHours) *
    100
  ).toFixed(1)}%)<br>
            Total Unique Customers: ${data.uniqueCustomers}<br>
            Total Available Booking Hours (All Bays): ${totalAvailableHours.toFixed(
              2
            )}<br>
            Overall Capacity Utilization: ${capacityUtilization.toFixed(2)}%
        </div>

        <h2>Bay Utilization</h2>
        <div class="utilization-grid">
            ${data.bayUtilizations
              .map(
                (bay) => `
                <div class="bay-card">
                    <h3>Bay ${bay.bayNumber}</h3>
                    <p>Total Bookings: ${bay.totalBookings}</p>
                    <p>Total Hours: ${bay.totalHours.toFixed(2)}</p>
                    <p>Utilization: ${bay.utilizationPercentage.toFixed(2)}%</p>
                </div>
            `
              )
              .join("")}
        </div>

        <h2>Customer Summary - ${monthName} ${year}</h2>
        <table>
            <thead>
                <tr>
                    <th>Customer ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Total Bookings</th>
                    <th>Total Hours</th>
                    <th>Prime Time Hours</th>
                    <th>Regular Hours</th>
                </tr>
            </thead>
            <tbody>
    `;

  for (const summary of data.customerSummaries) {
    const primeTimePercentage = (
      (summary.primeTimeHours / summary.totalBookingHours) *
      100
    ).toFixed(1);
    html += `
                <tr>
                    <td>${summary.customerId}</td>
                    <td>${summary.firstName} ${summary.lastName}</td>
                    <td>${summary.email}</td>
                    <td>${summary.totalBookings}</td>
                    <td>${summary.totalBookingHours.toFixed(2)}</td>
                    <td>${summary.primeTimeHours.toFixed(
                      2
                    )} (${primeTimePercentage}%)</td>
                    <td>${summary.regularHours.toFixed(2)} (${(
      100 - parseFloat(primeTimePercentage)
    ).toFixed(1)}%)</td>
                </tr>
            `;
  }

  html += `
            </tbody>
        </table>
    </body>
    </html>
    `;

  return html;
}
