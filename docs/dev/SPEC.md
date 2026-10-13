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
