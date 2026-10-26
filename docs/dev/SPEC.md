## Project Specification: Expense Tracker

## 1. Project Overview

App that allows the user to input their bank statement and from this calculate monthly expenses. Expenses are shown in different categories, which are customizable. Based on this, the system gives suggestions to the user to reduce their expenses. 

To maximize privacy and reduce server costs the app uses a **split-brain** architecture: Sensitive data (such as name and address on the bank statement) is anonimized locally. Statements from popular banks are processed locally using custom parsers. As much expenses as possible are classified locally. Only after removing personal information and locally processing as much data as possible, the app queries an external LLM to classify the remaining expenses and generate suggestions for reducing them. 

## 2. Target User and Inputs

The user is a financially conscious individual living in Guatemala who wants to better understand their spending habits and identify areas where they can save money.

**Required User Inputs**

These fields are shown to the user upon first access to the app:
* Bank statement upload: The user uploads their bank statement in PDF format. For the prototype/MVP we are developing, it will allow a single PDF.
* Custom CSV upload: The user can upload a custom CSV with their expenses.

## 3. The Step-by-Step User Flow

1. **Landing:** The user arrives at the site.
2. **File upload:** The user uploads their bank statement in PDF format. They can choose to use a custom CSV upload instead.
3. **Initial processing:** This process will happen silently in the server.
    3.1. For a PDF upload: The system will use a library to extract data from the PDF. The system will try to identify the bank locally. If it is able to, it will use the custom parser to extract the expenses.
    3.2. For a CSV upload: The system will use a library to extract data from the CSV. The system will try to identify columns such as date, description, and amount.

If a PDF from an unsupported bank was uploaded, steps 4 and 5 will happen. If it was a CSV or a PDF from a supported bank, step 6 will happen instead.

4. **Anonimization:** If the user uploaded a PDF bank statement, and it is from an unsupported bank, personal information such as name and address will be removed from it. The sanitized PDF will be shown to the user so they can confirm that the information was removed correctly before sending it to the LLM.
5. **Data extraction from unsupported bank:** The sanitized PDF will be sent to an LLM to extract the expenses. The LLM will be required to return the information in a specific JSON format.

6. **Data structuring:** The system will extract data from the PDF or CSV. It will be strucutred in a JSON.

At this point we have the expenses structured into a JSON object. To improve performance, no PDF or CSV will be used from this point onwards.

7. **Local expense classification:** The system will try to classify each expense locally. For the most popular businesses in Guatemala, some predefined categories will be available.

If very few expenses were unclassified, we will skip step 8 in order to reduce costs. The limit will be 5 unclassified expenses, this limit can be configured in the server.

8. **LLM-assisted expense classification:** The unclassified expenses from step 7 will be sent to an LLM to classify them. Some predefined categories will be provided to the LLM to improve classification.

9. **User confirmation and customization:** The user will be shown the proposed classification. If some expenses were left unclassified and we skipped step 8, those will be clearly shown. The user will be able to accept the classification or modify it. The user will also be able to add new categories or modify existing ones.
10. **Data reporting:** The user will be able to see a report of their expenses aggregated by category. Some of the information that will be shown includes:
    10.1. Comparison across different categories.
    10.2. Identification of subscriptions: Specific expenses will be identified (e.g. Netflix) and the user will be alerted to the fact that they have a subscription.
11. **Spending reduction suggestions:** Using the aggregated data, an LLM will be prompted to provide suggestions on how to reduce spending. The suggestions will be presented to the user.

### 3.1. Simplified User Flow

```
flowchart TD
    A[Start] --> B[Upload PDF/CSV];
    B --> |CSV| C[Identify columns];
    B --> |PDF from known bank| D[Extract data];
    B --> |PDF from unknown bank| E[Anonymize];
    E --> F[Extract using LLM];
    C --> G[Structure data];
    D --> G;
    F --> G;
    G --> H[Classify expenses locally];
    H --> |Unclassified <= 5| I[Customization];
    H --> |Unclassified > 5| J[Classify using LLM];
    J --> I;
    I --> K[Data reporting];
    K --> |Aggregated data| L[Get suggestions using LLM];
```

## 4. Scope Boundaries
- **In Scope:** Simple, responsive interface. Import of a single PDF or CSV. Saving data locally.
- **Out of Scope:** User authentication. Saving data to a database. PDF export.

## 5. Non-Functional Requirements
- **User Privacy:** Personal user data, such as name and address, should never be included in the prompts sent to external LLMs.
- **Cost Optimization:** To reduce costs when calling LLMs, as much information as possible will be identified locally. The PDF will not be sent to the LLM; instead, lighter structured information will be sent.
- **Availability:** In case of failure to connect to the LLM, all possible expenses will be classified locally, and the user will be given the option to manually classify the remaining ones.
- **Performance:** The app should be responsive and the user should not have to wait long for the results. This means we should strive for local processing as much as possible.

---

## Second Iteration

For the second iteration of this project, we will implement the following changes. These changes will be categorized in three categories. The categories are only for internal control in the progress meetings, they have no impact on implementation or on user experience.

### Core improvements
These changes improve the functionality of the app, but will be almost unnoticeable to the end user. They are mostly related to performance and to reduce costs, and as a base for other features.

- Additional banks will be supported via their own custom parser. We'll start with support for Banco Industrial, Banco Agromercantil, Banrural. The objective is to have support for enough banks, so the LLM call to extract expenses can be removed.

- Expenses in dollars will be considered when generating the expense list. When a transaction in dollars is identified, its amount will be converted to quetzales. The transaction list will have a small indicator to tell if a transaction was originally in quetzales or dollars, but this will have no effect on the calculations. We will use USD 1.00 = GTQ 7.85 as exchange rate. The exchange rate can be configured in the server.

- Add more merchants to the local classification. Increase the amount of merchants in each category so most of the classification is done locally, after enough merchants are added we will remove the LLM call to extract expenses. We will also need to adjust the default threshold for unclassified expenses, it will increase to 10 at this time.

### Quality of life
These changes improve the user experience but add almost no functionality.

- There will be support for uploading multiple files, either at the same time or one after another. Each new file will automatically be added to the current session. The only way to restart a session is to manually hit the corresponding button. When new files are added, the system will check for repeated transactions in case the user accidentally uploads the same file again. The repeated transactions will be detected based on all data matching (date, description, amount). Repeated transactions will be discarded and the user will be alerted (how many repeats were discarded and a message telling them that it might be a repeated file).

### Product improvements
These changes directly improve the product functionality and the user experience. When presenting this app as a product in the weekly meetings, this will be the most relevant changes to focus on.

The main feature in this iteration will be presenting the results after categorization as a dashboard.

In this iteration we will remove the current cards that show stats (both the totals and the line bar) the recurring expenses panel and the suggested savings panel. These will be replaced by the dashboard. These files should not be deleted, these files should be documented as deprecated.

If the user has less than 10 unclassified expenses, the dashboard will be shown.

- Dashboard UI/UX:
    - The dashboard will take all the screen when viewed in a computer or on a landscape orientation tablet, everything should fit nicely. We will decide later the best approach for smaller or portrait orientation screens.
    - The transaction list will be hidden once we move to the dashboard, there will be a button to show it again. The transaction list will slide from one side of the screen, and slide back when the user hits the button again.
    - The dashboard will be divided in four panels, which are detailed next.

- Panel 1: Basic information. Some basic info about the user's spending.
    - Line graph to show the expenses by category throughout the uploaded months.
    - One line in the graph for each category, use the designated colors.
    - Option to filter categories, so they are not shown in the graph.

- Panel 2: Where is my money going? Will help the user visualize where they are spending the most.
    - Bar graph showing the top vendors.
    - A selector lets the user switch between two graphs: vendor with the highest amount of money / vendor with the highest amount of transactions.

- Panel 3: Consumption patterns. Will help the user identify patterns in their spending.
    - A selector lets the user switch between two graphs: day of the week (bar graph, x-axis from Monday to Sunday) / day of the month (bar graph, x-axis from 1 to 31).
    - Show the user if there was some outlier: a day where significantly more money was spent than the average.
    - Show the user if there was some outlier throughout the months: Use this example: the user usually spends almost nothing the 15 of each month, but there was a month in particular with a lot of spending that day.

- Panel 4: Transaction age. Help the user visualize when the decision to spend was made.
    - Pie chart that compares between three aggregated categories:
        - Visacuotas / Mastercuotas / Extrafinanciamiento: The user is paying for something they bought some time ago. Add a new category for this in `merchant-catalog.json`.
        - Subscriptions: Recurring expenses that the user is paying each month. Use the already existing category.
        - Immediate purchases: All other purchases, made in the current month.
    - Option to filter which months are included in the calculations.

## Third Iteration

### UI/UX Tasks

Implement the following UI/UX changes. If the UI would change, use the `frontend-design` skill.

General UI/UX tasks:
- In the dashboard screen we have two redundant buttons: `Reiniciar sesión` and `Borrar mis datos`. Remove `Borrar mis datos` which deletes everything, and keep `Reiniciar sesión` which asks if the user wants to also remove personalized categories.
- In the load file screen we have `Borrar mis datos`, put `Reiniciar sesión` with the same functionality instead.
- In the load file screen we have `Nueva carga de estado de cuenta`. Remove this button since its behaviour is dangerous: it removes the previous session without confirming with the user.

Tasks for all the panels:
- For each panel add a small button to minimize it, in the upper right corner. When minimize is clicked, the panel should hide and only the chip/title should remain visible. The panel should be restored when the chip/title is clicked. When a panel is minimized, the panels below move up. When a panel is restored, the panels below move down.
- Besides the minimize button, add a `Info` button. When it is clicked a small tutorial for that panel should appear. Put some very basic info for each panel at this time (a couple lines at most), I will add information later.

Tasks for panel 1:
- Add this functionality when clicking the points in the graph: When a point is clicked, the view transactions side panel opens and filters to show only the transactions of that month and that type.
- Add this functionality when clicking the trend line in the graph: When a trend line is clicked, hide the other category lines so the user can focus on a single category. When that happens, a small chip appears with "Mostrar todo"; when that chip is clicked, show all the category lines again. Do not show the chip if the user hovers over the trend line, only when it's clicked.

Tasks for panel 2:
- Most of the useful information for the user is not on the top 5 expenses, so add this functionality: When some vendor is clicked (in either the two views on this panel), it is dismissed. It stops showing, the vendors below move up, and the next vendor in order shows up. There must be 5 vendors visible at a time (unless the user has clicked a lot of them and has dismissed them all). When some vendor is dismissed, a small chip appears with "Mostrar todo"; when that chip is clicked, show all the dismissed vendors again.
- Save in localStorage which tab the user viewed last (`Mayor monto gastado` or `Mayor cantidad de compras`). When the user goes to the dashboard again, open the last used tab.

Tasks for panel 3:
- Set the `Día del mes` tab as the default. ave in localStorage which tab the user viewed last (`Día de la semana` or `Día del mes`). When the user goes to the dashboard again, open the last used tab.
- When the user clicks on a bar, the view transactions side panel opens and filters to show only the transactions of that day of the week/month.

Tasks for panel 4:
- Check the colors used on the donut chart. They should be easy to distinguish.