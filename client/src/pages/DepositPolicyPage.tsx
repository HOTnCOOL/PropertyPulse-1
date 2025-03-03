import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function DepositPolicyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="container max-w-3xl py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => window.history.back()}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1>Deposit Policy</h1>

        <h2>Overview</h2>
        <p>
          We aim to make your booking process as straightforward as possible. Below are the details of our
          deposit policy, designed to clarify the requirements for various booking scenarios.
        </p>

        <h3>Security Deposit Requirements</h3>
        <h4>General Rules</h4>
        <ul>
          <li>No security deposit is charged for bookings with 3+ prepaid payment periods</li>
          <li>For all stays longer than 3 nights that are only partially paid, a security deposit must be paid in advance or guaranteed by credit card</li>
          <li>The security deposit is fully refundable after checkout and property inspection</li>
          <li>If at least two payment periods of the same type are prepaid, the deposit is reduced by 50%</li>
        </ul>

        <h4>Security Deposit Amount</h4>
        <p>The amount of the security deposit is determined according to the duration of your stay:</p>
        <ol>
          <li>$70 for stays longer than 3 days and shorter than 2 weeks (equivalent to one day's rate)</li>
          <li>$420 for stays longer than 2 weeks and shorter than 2 months (equivalent to one 7-day period)</li>
          <li>$1500 for stays longer than 2 months (equivalent to one 30-day period)</li>
        </ol>

        <h3>Summary of Payment Options</h3>
        <p>
          To help you better understand your payment options, we present several scenarios illustrating
          how your bookings may be structured based on preferred payment plans:
        </p>

        <h4>30-Day Payment Plan</h4>
        <ul>
          <li>Rate: $1500 every 30 days ($50/night equivalent)</li>
          <li>Best value for longer stays of 30+ days</li>
          <li>Initial Payment Required: First 30-day payment period + security deposit (if applicable)</li>
        </ul>

        <h4>7-Day Payment Plan</h4>
        <ul>
          <li>Rate: $420 every 7 days ($60/night equivalent)</li>
          <li>Good balance between value and flexibility for medium-length stays</li>
          <li>Initial Payment Required: First 7-day payment period + security deposit (if applicable)</li>
        </ul>

        <h4>Daily Payment Plan</h4>
        <ul>
          <li>Rate: $70 per day</li>
          <li>Maximum flexibility for payment scheduling, but at a higher overall cost</li>
          <li>Initial Payment Required: First day's payment + security deposit (if applicable)</li>
        </ul>

        <h3>Need Assistance?</h3>
        <p>
          If you have questions regarding the deposit or payment policy, our support team is available
          to assist you with more details. Please reach out for clarification!
        </p>
      </div>
    </div>
  );
}
