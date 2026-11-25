# ExamScheduler — Project Knowledge Base

## Project summary
ExamScheduler is an educational Round Robin CPU scheduling simulator based on an online college examination system. It models student login, loading question papers, saving answers, submitting an examination, and generating results as CPU processes.

## Round Robin
Round Robin is a preemptive CPU scheduling algorithm. It uses a FIFO ready queue and gives each ready process a maximum CPU time called the time quantum. If a process has remaining burst time when its slice ends, it moves to the back of the queue. New arrivals are added to the ready queue when their arrival time is reached.

## Formulas
Completion Time (CT): time when a process finishes. Turnaround Time (TAT) = CT - Arrival Time (AT). Waiting Time (WT) = TAT - Burst Time (BT). Response Time (RT) = first CPU start - Arrival Time. CPU utilization = total busy CPU time / makespan * 100.

## Reference example
Time quantum = 2 ms. Processes: P1 Student Login AT 0 BT 5; P2 Load Question/Paper AT 0 BT 4; P3 Save Answers AT 0 BT 3; P4 Submit Examination AT 0 BT 2; P5 Generate Result AT 0 BT 4. Gantt order: P1 0–2, P2 2–4, P3 4–6, P4 6–8, P5 8–10, P1 10–12, P2 12–14, P3 14–15, P5 15–17, P1 17–18. Average waiting time 10.8 ms, average turnaround time 14.4 ms, average response time 4.0 ms, and CPU utilization 100% when context-switch overhead is ignored.

## Advantages and limitations
Advantages: fair sharing, good responsiveness for interactive workloads, prevents one ready process monopolizing the CPU, and simple FIFO queue logic. Limitations: a very small quantum increases context-switch frequency; a very large quantum approaches FCFS; average waiting time can be high; performance depends on quantum size.
