import React, { useEffect, useState, useCallback } from 'react';
import ButtonsLayout from './ButtonsLayout';
import Swal from 'sweetalert2';
import { createClient } from '@supabase/supabase-js';
import { pdf } from '@react-pdf/renderer';
import GeneratePDFDocument from './GeneratePDFDocument';
import { HiOutlineTrash } from "react-icons/hi";
import { HiOutlinePencil } from "react-icons/hi";
import { HiOutlineClock } from "react-icons/hi";
import { HiOutlineChatBubbleOvalLeft } from "react-icons/hi2";
import { HiOutlineDocumentCheck } from 'react-icons/hi2';
import { HiOutlineMail } from "react-icons/hi";
import dynamic from 'next/dynamic';
//import Image from 'next/image';
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { HiBarsArrowUp } from "react-icons/hi2";
import Image from 'next/image';
const PieChartComponent = dynamic(() => import('./PieChartComponent'), { ssr: false });

// Modifica la definizione di API_URL
// const API_URL = process.env.NODE_ENV === 'development' 
//   ? '' // URL vuoto per usare il path relativo
//   : 'https://gestioneingressi-4v65ymg2l-profisicagu-gmailcoms-projects.vercel.app';

// Configurazione di Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MainLayout = () => {
  const [alunni, setAlunni] = useState([]);
  const [selectedAlunnoId, setSelectedAlunnoId] = useState(null);
  const [selectedAlunno, setSelectedAlunno] = useState(null);
  const [genitori, setGenitori] = useState([]);
  const [coordinatore, setCoordinatore] = useState(null);
  const [ritardi, setRitardi] = useState([]);
  const [ritardiState, setRitardiState] = useState([]);
  const [error, setError] = useState(null);
  const Select = dynamic(() => import('react-select'), { ssr: false });
  const [alunniConRitardi, setAlunniConRitardi] = useState([]);

  //const formatDateForUI = (date) => date.split('-').reverse().join('.'); // Da "2024-12-15" a "15.12.2024"
 
  
  //const formatTimeForUI = (time) => time.slice(0, 5); // Da "11:50:34" a "11:50"

 /* eslint-disable @typescript-eslint/no-unused-vars */


  
  const [ritardiOdierni, setRitardiOdierni] = useState([]); // Stato separato per ritardi odierni

  // Funzione per recuperare tutti gli alunni
  const fetchAlunni = async () => {
    const { data, error } = await supabase.from('alunni').select('*'); // Assicurati di avere la tabella corretta
    if (error) {
      console.error("Errore nel recupero degli alunni:", error);
      return;
    }
    setAlunni(data);
  };
// Carica tutti gli alunni all'avvio del componente
useEffect(() => {
  fetchAlunni();
}, []);


useEffect(() => {
  fetchAlunniConRitardi();
}, []);


const fetchAlunniConRitardi = async () => {
  try {
    // Passo 1: Trova gli alunni con almeno un ritardo "P*"
    const { data: alunniConPStar, error: errorPStar } = await supabase
      .from("ritardi")
      .select("id_alunno")
      .eq("motivazione", "P*");

    if (errorPStar) throw errorPStar;

    // Ottieni gli ID unici degli alunni con almeno un "P*"
    const idAlunniConPStar = [...new Set(alunniConPStar.map((ritardo) => ritardo.id_alunno))];

    if (idAlunniConPStar.length === 0) {
      setAlunniConRitardi([]); // Nessun alunno con "P*"
      return;
    }

    // Passo 2: Trova gli alunni che hanno almeno una bustina verde (emailinviata = true)
    const { data: alunniConBustina, error: errorBustina } = await supabase
      .from("ritardi")
      .select("id_alunno")
      .eq("emailinviata", true);

    if (errorBustina) throw errorBustina;

    // Ottieni gli ID unici degli alunni con bustina verde
    const idAlunniConBustina = new Set(alunniConBustina.map((ritardo) => ritardo.id_alunno));

    // Passo 3: Filtra gli alunni che hanno "P*" ma NON hanno bustina verde
    const idAlunniFinale = idAlunniConPStar.filter((id) => !idAlunniConBustina.has(id));

    if (idAlunniFinale.length === 0) {
      setAlunniConRitardi([]); // Nessun alunno da mostrare
      return;
    }

    // Passo 4: Recupera i dettagli degli alunni filtrati
    const { data: alunniFinali, error: errorFinale } = await supabase
      .from("alunni")
      .select("id_alunno, cognome, nome, id_classe, classi(nome_classe)")
      .in("id_alunno", idAlunniFinale)
      .order("cognome", { ascending: true });

    if (errorFinale) throw errorFinale;

    // Mappa gli alunni con il formato corretto per il dropdown
    const uniqueAlunni = alunniFinali.map((alunno) => ({
      id_alunno: alunno.id_alunno,
      nominativo: `${alunno.cognome} ${alunno.nome}`.trim(),
      classe: alunno.classi?.nome_classe || "N/D",
    }));

    setAlunniConRitardi(uniqueAlunni); // Aggiorna lo stato con gli alunni filtrati
  } catch (error) {
    console.error("Errore nel recupero degli alunni con ritardi P* senza bustina:", error.message);
  }
};



  // Funzione per gestire i ritardi senza stampa
  const handleButtonClick = async (motivazione) => {
    if (!isStudentNameValid()) return;

    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split("T")[0];
    const formattedTime = currentDate.toTimeString().split(" ")[0];

    // Ottieni tutti i ritardi combinati
    const combinedRitardi = getCombinedRitardi();

    // Conta il numero di ritardi con motivazione "P"
    const countPersonale = combinedRitardi.filter(
      (ritardo) => ritardo.motivazione === "P"
    ).length;

    // Se ci sono già 3 "P", modifica la motivazione in "P*"
    if (motivazione === "P" && countPersonale >= 3) {
      motivazione = "P*";
    }

    const newRitardo = {
      id_alunno: selectedAlunno?.id_alunno,
      data: formattedDate,
      orario_ingresso: formattedTime,
      motivazione,
    };

    // Inserimento nel database
    const { error } = await supabase.from("ritardi").insert([newRitardo]);

    if (error) {
      console.error(" Errore durante l'inserimento:", error.message);
      Swal.fire("Errore", "Impossibile inserire il ritardo.", "error");
      return;
    }

    // Ricarica tutti i ritardi per forzare l'aggiornamento
    await fetchDatiAlunno(); // Questa funzione deve recuperare tutti i dati dell'alunno corrente
    Swal.fire(
      "Successo",
      `Ritardo inserito con motivazione "${motivazione}"`,
      "success"
    );
  };
  

  {/*
 // Funzione per gestire i ritardi con stampa. FUNZIONA MA NELLA STAMPA SONO POSSIBILI DEI MIGLIORAMENTI
  const handleButtonWithPrintDialog = async (motivazione) => {
    if (!isStudentNameValid()) return;
  
    try {
      // Ottieni data e ora correnti
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split("T")[0];
      const formattedTime = currentDate.toTimeString().split(" ")[0];
  
      // Conta i ritardi con motivazione "P"
      const combinedRitardi = getCombinedRitardi();
      const countPersonale = combinedRitardi.filter(
        (ritardo) => ritardo.motivazione === "P"
      ).length;
  
      // Aggiorna la motivazione se necessario
      if (motivazione === "P" && countPersonale >= 3) {
        motivazione = "P*";
      }
  
      // Inserisci il nuovo ritardo nel database
      const newRitardo = {
        id_alunno: selectedAlunno?.id_alunno,
        data: formattedDate,
        orario_ingresso: formattedTime,
        motivazione,
      };
  
      const { error } = await supabase.from("ritardi").insert([newRitardo]);
      if (error) {
        console.error("Errore durante l'inserimento del ritardo:", error.message);
        Swal.fire("Errore", "Impossibile inserire il ritardo.", "error");
        return;
      }
  
      // Aggiorna i dati dell'alunno nella UI
      await fetchDatiAlunno();
  
      // Recupera i ritardi aggiornati direttamente dal database
      const { data: updatedRitardi, error: fetchError } = await supabase
        .from("ritardi")
        .select("*")
        .eq("id_alunno", selectedAlunno?.id_alunno);
  
      if (fetchError) {
        console.error("Errore nel recupero dei ritardi aggiornati:", fetchError.message);
        Swal.fire("Errore", "Impossibile recuperare i dati aggiornati.", "error");
        return;
      }
  
      console.log("Ritardi aggiornati per il PDF:", updatedRitardi);
  
      // Genera il PDF con i ritardi aggiornati
      const studentDataForPDF = {
        ...selectedAlunno,
        ritardi: updatedRitardi,
      };
  
      // Genera il PDF come Blob
      const blob = await pdf(<GeneratePDFDocument student={studentDataForPDF} />).toBlob();
  
      // Crea un nome file nel formato "Cognome Nome [Classe].pdf"
      const fileName = `${selectedAlunno.cognome}_${selectedAlunno.nome} [${selectedAlunno.classe || "Senza Classe"}].pdf`;
  
      // Chiedi all'utente se desidera scaricare o stampare il PDF
      const { value: action } = await Swal.fire({
        title: "Cosa vuoi fare?",
        icon: "question",
        input: "radio",
        inputOptions: {
          download: "Scarica il PDF",
          print: "Stampa il PDF",
        },
        inputValidator: (value) => {
          if (!value) {
            return "Devi scegliere un'opzione!";
          }
        },
        showCancelButton: true,
        confirmButtonText: "Conferma",
        cancelButtonText: "Annulla",
      });
  
      if (!action) {
        Swal.fire("Operazione annullata", "Nessuna azione è stata eseguita.", "info");
        return;
      }
  
      if (action === "download") {
        // Scarica il PDF
        saveAs(blob, fileName);
        Swal.fire("Successo", "Il PDF è stato scaricato correttamente.", "success");
      } else if (action === "print") {
        // Stampa il PDF
        const pdfURL = URL.createObjectURL(blob);
        const printWindow = window.open(pdfURL, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
            printWindow.onafterprint = () => {
              printWindow.close();
              URL.revokeObjectURL(pdfURL); // Libera la memoria dell'URL
            };
          };
        } else {
          Swal.fire("Errore", "Impossibile aprire la finestra di stampa.", "error");
        }
      }
    } catch (error) {
      console.error("Errore generale:", error.message);
      Swal.fire("Errore", "Si è verificato un errore durante la generazione o la stampa del PDF.", "error");
    }
  };  
*/}




 // Funzione per gestire i ritardi con stampa. FUNZIONA !!!
  const handleButtonWithPrintDialog = async (motivazione) => {
    if (!isStudentNameValid()) return;
  
    try {
      // Ottieni data e ora correnti
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split("T")[0];
      const formattedTime = currentDate.toTimeString().split(" ")[0];
  
      // Conta i ritardi con motivazione "P"
      const combinedRitardi = getCombinedRitardi();
      const countPersonale = combinedRitardi.filter(
        (ritardo) => ritardo.motivazione === "P"
      ).length;
  
      // Aggiorna la motivazione se necessario
      if (motivazione === "P" && countPersonale >= 3) {
        motivazione = "P*";
      }
  
      // Inserisci il nuovo ritardo nel database
      const newRitardo = {
        id_alunno: selectedAlunno?.id_alunno,
        data: formattedDate,
        orario_ingresso: formattedTime,
        motivazione,
      };
  
      const { error } = await supabase.from("ritardi").insert([newRitardo]);
      if (error) {
        console.error("Errore durante l'inserimento del ritardo:", error.message);
        Swal.fire("Errore", "Impossibile inserire il ritardo.", "error");
        return;
      }
  
      // Aggiorna i dati dell'alunno nella UI
      await fetchDatiAlunno();
  
      // Recupera i ritardi aggiornati direttamente dal database
      const { data: updatedRitardi, error: fetchError } = await supabase
        .from("ritardi")
        .select("*")
        .eq("id_alunno", selectedAlunno?.id_alunno);
  
      if (fetchError) {
        console.error("Errore nel recupero dei ritardi aggiornati:", fetchError.message);
        Swal.fire("Errore", "Impossibile recuperare i dati aggiornati.", "error");
        return;
      }
  
      console.log("Ritardi aggiornati per il PDF:", updatedRitardi);
  
      // Genera il PDF con i ritardi aggiornati
      const studentDataForPDF = {
        ...selectedAlunno,
        ritardi: updatedRitardi,
      };
  
      // Genera il PDF come Blob
      const blob = await pdf(<GeneratePDFDocument student={studentDataForPDF} />).toBlob();
  
      // Crea un nome file nel formato "Cognome Nome [Classe].pdf"
      const fileName = `${selectedAlunno.cognome}_${selectedAlunno.nome} [${selectedAlunno.classe || "Senza Classe"}].pdf`;
  
      // Chiedi all'utente se desidera scaricare o stampare il PDF
      const { value: action } = await Swal.fire({
        title: "Cosa vuoi fare?",
        icon: "question",
        input: "radio",
        inputOptions: {
          download: "Scarica il PDF",
          print: "Stampa il PDF",
        },
        inputValidator: (value) => {
          if (!value) {
            return "Devi scegliere un'opzione!";
          }
        },
        showCancelButton: true,
        confirmButtonText: "Conferma",
        cancelButtonText: "Annulla",
      });
  
      if (!action) {
        Swal.fire("Operazione annullata", "Nessuna azione è stata eseguita.", "info");
        return;
      }
  
      if (action === "download") {
        // Scarica il PDF
        saveAs(blob, fileName);
        Swal.fire("Successo", "Il PDF è stato scaricato correttamente.", "success");

      } else if (action === "print") {
        // Creazione dell'URL temporaneo per il PDF
        const pdfURL = URL.createObjectURL(blob);
    
        // Creazione di un iframe nascosto per la stampa diretta
        const iframe = document.createElement("iframe");
        iframe.style.display = "none"; // Nasconde l'iframe
        document.body.appendChild(iframe);
    
        iframe.src = pdfURL;
        iframe.onload = () => {
            iframe.contentWindow.print(); // Avvia la stampa
    
            // Se il browser supporta onafterprint, rimuovi l'iframe dopo la stampa
            iframe.contentWindow.onafterprint = () => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(pdfURL); // Libera la memoria
            };
        };
    
        // Gestione degli errori nel caricamento dell'iframe
        iframe.onerror = () => {
            Swal.fire("Errore", "Impossibile avviare la stampa.", "error");
            document.body.removeChild(iframe);
            URL.revokeObjectURL(pdfURL);
        };
    }
    



    } catch (error) {
      console.error("Errore generale:", error.message);
      Swal.fire("Errore", "Si è verificato un errore durante la generazione o la stampa del PDF.", "error");
    }
  };  


  const handlePrintWithoutAdding = async (motivazione) => {
    if (!isStudentNameValid()) return;
  
    try {
      // Ottieni data e ora correnti
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split("T")[0];
      //const formattedTime = currentDate.toTimeString().split(" ")[0];
  
      // Ottieni tutti i ritardi combinati
      const combinedRitardi = getCombinedRitardi();
  
      // Conta il numero di ritardi con motivazione "P"
      const countPersonale = combinedRitardi.filter(
        (ritardo) => ritardo.motivazione === "P"
      ).length;
  
      // Se ci sono già 3 "P", modifica la motivazione in "P*"
      if (motivazione === "P" && countPersonale >= 3) {
        motivazione = "P*";
      }
  
      // Prepara i dati per il PDF utilizzando i ritardi esistenti
      const studentData = {
        ...selectedAlunno,
        ritardi: combinedRitardi, // Usa solo i ritardi esistenti
      };
  
      // Genera il PDF
      const blob = await pdf(<GeneratePDFDocument student={studentData} />).toBlob();
      const fileName = `${selectedAlunno.cognome}_${selectedAlunno.nome}(${formattedDate.split('-').reverse().join('-')}).pdf`;
      
      // Salva il PDF con il nome corretto
      saveAs(blob, fileName);
  
      Swal.fire(
        "Successo",
        `PDF generato e inviato alla stampa con motivazione "${motivazione}"`,
        "success"
      );
    } catch (error) {
      console.error("Errore generale:", error.message);
      Swal.fire("Errore", "Si è verificato un errore imprevisto.", "error");
    }
  };
  

    const handleGenerateExcelForDate = async () => {
    try {
      const { value: selectedDate } = await Swal.fire({
        title: 'Seleziona una data',
        html: '<input type="date" id="selectedDate" class="swal2-input" />',
        preConfirm: () => document.getElementById('selectedDate')?.value,
        showCancelButton: true,
        confirmButtonText: 'Genera Report',
        cancelButtonText: 'Annulla',
      });
  
      if (!selectedDate) {
        Swal.fire('Operazione annullata', 'Nessuna data selezionata', 'info');
        return;
      }
  
      const { data: ritardi, error } = await supabase
        .from('ritardi')
        .select(`
          id_ritardo,
          data,
          orario_ingresso,
          motivazione,
          alunni ( cognome, nome, classi ( nome_classe ) )
        `)
        .eq('data', selectedDate);
  
      if (error) throw error;
  
      if (!ritardi || ritardi.length === 0) {
        Swal.fire('Nessun risultato', 'Non ci sono ritardi per la data selezionata.', 'info');
        return;
      }
  
      const rows = ritardi.map((ritardo, index) => ({
        Numero: index + 1,
        Nominativo: `${ritardo.alunni?.cognome || ''} ${ritardo.alunni?.nome || ''}`.trim(),
        Classe: ritardo.alunni?.classi?.nome_classe || 'N/D',
        Orario: ritardo.orario_ingresso?.slice(0, 5) || 'N/D',
        Motivazione: ritardo.motivazione || 'N/D',
      }));
  
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ritardi');
  
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(blob, `Ritardi_${selectedDate}.xlsx`);
  
      Swal.fire('Successo', 'Il report è stato generato con successo!', 'success');
    } catch (error) {
      console.error('Errore durante la generazione del report:', error);
      Swal.fire('Errore', 'Impossibile generare il report.', 'error');
    }
  };
  

  const getCombinedRitardi = () => {
    const combined = [...ritardi, ...ritardiState];
  
    if (combined.length === 0) {
      console.warn("Nessun ritardo combinato trovato.");
    } else {
      console.log(" Ritardi combinati:", combined);
    }
  
    return combined;
  };
  
   
// Fetch iniziale: elenco alunni
useEffect(() => {
  const fetchAlunni = async () => {
    try {
      let allData = []; // Array per raccogliere tutti i dati
      let offset = 0; // Offset iniziale
      const limit = 1000; // Limite massimo per richiesta
      let hasMore = true;

      while (hasMore) {
        // Recupera i dati in blocchi
        const { data, error } = await supabase
          .from('alunni')
          .select('id_alunno, cognome, nome, id_classe, classi(nome_classe)')
          .order('cognome', { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) throw error;

        // Aggiungi i dati recuperati all'array
        allData = [...allData, ...data];
        hasMore = data.length === limit; // Se il blocco è pieno, continua
        offset += limit; // Incrementa l'offset
      }

      // Elabora i dati ricevuti
      const alunniConClasse = allData.map((alunno) => ({
        ...alunno,
        nominativo: `${alunno.cognome} ${alunno.nome}`.trim(),
        classe: alunno.classi?.nome_classe || 'N/D',
      }));

      setAlunni(alunniConClasse); // Aggiorna lo stato con tutti i dati
    } catch (error) {
      setError(error.message);
      console.error('Errore nel recupero degli alunni:', error.message);
    }
  };

  fetchAlunni();
}, []);

// Funzione per recuperare i dati completi dell'alunno selezionato
const fetchDatiAlunno = useCallback(async (forceRefresh = false) => {
  if (!selectedAlunnoId && !forceRefresh) {
    setRitardi([]);
    setRitardiState([]);
    setSelectedAlunno(null);
    setGenitori([]);
    setCoordinatore(null);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('alunni')
      .select(`
        id_alunno,
        cognome,
        nome,
        id_classe,
        indirizzo_residenza,
        comune_residenza,
        data_nascita,
        alunni_genitori (
          tipo,
          genitori (
            cognome,
            nome,
            email,
            cellulare1,
            cellulare2
          )
        ),
        ritardi (
          id_ritardo,
          data,
          orario_ingresso,
          motivazione,
          emailinviata
        ),
        classi (
          nome_classe,
          coordinatori (
            cognome,
            nome,
            email,
            cellulare
          )
        )
      `)
      .eq('id_alunno', selectedAlunnoId)
      .single();

    if (error) throw error;

    const selectedAlunnoConClasse = {
      ...data,
      nominativo: `${data.cognome} ${data.nome}`.trim(),
      classe: data.classi?.nome_classe || "N/D",
    };

    const genitori = data.alunni_genitori.map((entry) => ({
      tipo: entry.tipo,
      ...entry.genitori,
    }));

    setSelectedAlunno(selectedAlunnoConClasse);
    setRitardi(data.ritardi || []);
    setRitardiState([]);
    setGenitori(genitori);
    setCoordinatore(data.classi?.coordinatori || null);
  } catch (error) {
    setError(error.message);
    console.error("Errore nel recupero dei dati dell'alunno:", error.message);
  }
}, [selectedAlunnoId]);

// Effetto al cambio di `selectedAlunnoId`
useEffect(() => {
  fetchDatiAlunno(); // Recupera i dati dell'alunno
}, [fetchDatiAlunno]);

const formatDateForUI = (dateString) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
};

const updateEmailInviataInDatabase = async (idRitardo) => {
  try {
    const { error } = await supabase
      .from("ritardi")
      .update({ emailinviata: true })
      .eq("id_ritardo", idRitardo);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Errore durante l'aggiornamento di emailinviata:", error.message);
    return false;
  }
};


const handleUpdateEmailInviata = async (idRitardo) => {
  try {
    // Aggiorna nel database per impostare emailinviata = true
    const { error } = await supabase
      .from("ritardi")
      .update({ emailinviata: true })
      .eq("id_ritardo", idRitardo);

    if (error) throw error;

    // Trova l'alunno associato al ritardo inviato
    const ritardo = ritardi.find((r) => r.id_ritardo === idRitardo);
    if (!ritardo) {
      console.warn("Ritardo non trovato nello stato.");
      return;
    }

    const idAlunno = ritardo.id_alunno;

    // Rimuove l'alunno dall'elenco `alunniConRitardi`
    setAlunniConRitardi((prev) => prev.filter((alunno) => alunno.id_alunno !== idAlunno));

    Swal.fire("Successo", "Email inviata e bustina verde aggiunta correttamente!", "success");
  } catch (error) {
    console.error("Errore durante l'aggiornamento:", error.message);
    Swal.fire("Errore", "Si è verificato un errore durante l'aggiornamento.", "error");
  }
};

const removeEmailInviataFromDatabase = async (idRitardo) => {
  try {
    const { error } = await supabase
      .from("ritardi")
      .update({ emailinviata: false })
      .eq("id_ritardo", idRitardo);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Errore durante la rimozione di emailinviata:", error.message);
    return false;
  }
};

const handleRemoveEmailInviata = async (idRitardo) => {
  try {
    // Controlla se l'ID ha già la bustina verde
    const ritardo = ritardi.find((r) => r.id_ritardo === idRitardo);

    if (!ritardo) {
      Swal.fire("Errore", "ID ritardo non trovato.", "error");
      return;
    }

    if (!ritardo.emailinviata) {
      Swal.fire("Errore", "La bustina verde non è presente per questo ritardo.", "error");
      return;
    }

    // Procedi con la rimozione se la bustina verde è presente
    const successo = await removeEmailInviataFromDatabase(idRitardo);

    if (successo) {
      // Aggiorna lo stato locale
      setRitardi((prevRitardi) =>
        prevRitardi.map((ritardo) =>
          ritardo.id_ritardo === idRitardo
            ? { ...ritardo, emailinviata: false }
            : ritardo
        )
      );
      Swal.fire("Successo", "Bustina verde rimossa correttamente!", "success");
    } else {
      Swal.fire("Errore", "Impossibile rimuovere la bustina verde.", "error");
    }
  } catch (error) {
    console.error("Errore durante la rimozione:", error.message);
    Swal.fire("Errore", "Si è verificato un errore durante la rimozione.", "error");
  }
};

const handleDeleteLastRitardo = async () => {
  const combinedRitardi = getCombinedRitardi();

  if (combinedRitardi.length === 0) {
    Swal.fire({
      title: "Errore",
      text: "Non ci sono ritardi da cancellare.",
      icon: "error",
      confirmButtonText: "OK",
    });
    return;
  }

  const lastRitardo = combinedRitardi[combinedRitardi.length - 1];

  if (ritardiState.includes(lastRitardo)) {
    // Cancella dall'elenco locale
    setRitardiState((prev) => prev.slice(0, -1));
  } else {
    // Cancella dal database
    try {
      const { error } = await supabase
        .from("ritardi")
        .delete()
        .eq("id_ritardo", lastRitardo.id_ritardo);

      if (error) throw error;

      setRitardi((prev) => prev.slice(0, -1));
      Swal.fire({
        title: "Successo",
        text: "L'ultimo ritardo è stato cancellato.",
        icon: "success",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Errore durante la cancellazione:", err.message);
      Swal.fire({
        title: "Errore",
        text: "Errore durante la connessione al database.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  }
};

  // Funzione per validare il nome dell'alunno
  const isStudentNameValid = () => {
    if (!selectedAlunno?.nominativo) {
      Swal.fire({
        title: 'Attenzione',
        text: "Il nome dell'alunno non può essere vuoto.",
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      return false;
    }
    return true;
  };

  const updateRitardoInDatabase = async (idRitardo, updateFields) => {
    try {
      const { error } = await supabase
        .from("ritardi")
        .update(updateFields)
        .eq("id_ritardo", idRitardo);
  
      if (error) throw error;
  
      console.log(` Ritardo con ID ${idRitardo} aggiornato con:`, updateFields);
      return true;
    } catch (error) {
      console.error("Errore nell'aggiornamento del ritardo:", error.message);
      return false;
    }
  };
  
  
  const handleUpdateRitardoDate = async (idRitardo, newDate) => {
    const successo = await updateRitardoInDatabase(idRitardo, { data: newDate });
  
    if (successo) {
      // Ricarica i dati dell'alunno per assicurarti che lo stato sia aggiornato
      await fetchDatiAlunno(true); // Passa true per forzare il refresh
      Swal.fire("Successo", "Data aggiornata con successo!", "success");
    } else {
      Swal.fire("Errore", "Non è stato possibile aggiornare la data.", "error");
    }
  };
  
  const handleUpdatePersonaleStarToPersonale = async () => {
    try {
      const combinedRitardi = getCombinedRitardi();

      if (combinedRitardi.length === 0) {
        Swal.fire("Errore", "Non ci sono ritardi da aggiornare.", "error");
        return;
      }

      // Filtra i ritardi con motivazione "Personale*"
      const ritardiToUpdate = combinedRitardi.filter(
        (ritardo) => ritardo.motivazione === "P*"
      );

      if (ritardiToUpdate.length === 0) {
        Swal.fire("Nessun aggiornamento", "Non ci sono ritardi con motivazione 'Personale*'.", "info");
        return;
      }

      // Aggiorna nel database
      const idsToUpdate = ritardiToUpdate.map((ritardo) => ritardo.id_ritardo);

      const { error } = await supabase
        .from("ritardi")
        .update({ motivazione: "P" })
        .in("id_ritardo", idsToUpdate);

      if (error) throw error;

      // Ricarica i dati per aggiornare lo stato
      await fetchDatiAlunno(true);

      Swal.fire("Successo", "Tutti i ritardi con motivazione 'Personale*' sono stati aggiornati a 'Personale'.", "success");
    } catch (error) {
      console.error("Errore durante l'aggiornamento dei ritardi:", error.message);
      Swal.fire("Errore", "Impossibile aggiornare i ritardi.", "error");
    }
  };
    

  // Funzione per generare e scaricare il PDF
  const handleDownloadPDF = async (selectedAlunno, ritardi) => {
    try {
      const studentData = {
        ...selectedAlunno,
        ritardi,
      };

      const blob = await pdf(<GeneratePDFDocument student={studentData} />).toBlob();
      // Crea un nome file nel formato COGNOME_NOME(DATA).pdf
      const currentDate = new Date().toLocaleDateString('it-IT').replace(/\//g, '-');
      const fileName = `${selectedAlunno.cognome}_${selectedAlunno.nome}(${currentDate}).pdf`;
      
      // Usa saveAs da file-saver per forzare il download con il nome corretto
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
    }
  };

  const updateRitardoOraInDatabase = async (idRitardo, nuovaOra) => {
    try {
      const { error } = await supabase
        .from("ritardi")
        .update({ orario_ingresso: nuovaOra })
        .eq("id_ritardo", idRitardo);
  
      if (error) throw error;
  
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'ora:", error.message);
      return false;
    }
  };
  
  const handleUpdateRitardoOra = async (idRitardo, newTime) => {
    const successo = await updateRitardoOraInDatabase(idRitardo, newTime);
  
    if (successo) {
      const updatedRitardi = getCombinedRitardi().map((ritardo) =>
        ritardo.id_ritardo === idRitardo ? { ...ritardo, orario_ingresso: newTime } : ritardo
      );
      setRitardi(updatedRitardi);
      Swal.fire("Successo", "Orario aggiornato con successo!", "success");
    } else {
      Swal.fire("Errore", "Non è stato possibile aggiornare l'orario.", "error");
    }
  };
    
  const updateRitardoMotivazioneInDatabase = async (idRitardo, nuovaMotivazione) => {
    try {
      console.log(` Aggiornamento motivazione: ID=${idRitardo}, Motivazione=${nuovaMotivazione}`);
      const { error } = await supabase
        .from("ritardi")
        .update({ motivazione: nuovaMotivazione })
        .eq("id_ritardo", idRitardo);
  
      if (error) throw error;
  
      console.log(` Motivazione aggiornata per ID ${idRitardo}`);
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento della motivazione:", error.message);
      return false;
    }
  };

  const handleUpdateRitardoMotivazione = async (idRitardo, newMotivazione) => {
    console.log(" Inizio aggiornamento motivazione per ID:", idRitardo, "con motivazione:", newMotivazione);

    try {
        const successo = await updateRitardoMotivazioneInDatabase(idRitardo, newMotivazione);

        if (successo) {
            console.log(" Motivazione aggiornata nel database con successo");
            await fetchDatiAlunno(true);
            Swal.fire("Successo", "Motivazione aggiornata con successo!", "success");
        } else {
            console.error(" Errore durante l'aggiornamento della motivazione");
            Swal.fire("Errore", "Impossibile aggiornare la motivazione.", "error");
        }
    } catch (error) {
        console.error(" Errore durante il processo di aggiornamento:", error);
        Swal.fire("Errore", "Si è verificato un errore durante l'aggiornamento.", "error");
    } finally {
        console.log(" Fine processo di modifica motivazione");
    }
};
  
  // FINE DEFINIZIONE FUNZIONI...............................................................................
  // FINE DEFINIZIONE FUNZIONI...............................................................................
  // FINE DEFINIZIONE FUNZIONI...............................................................................
  // FINE DEFINIZIONE FUNZIONI...............................................................................
  // FINE DEFINIZIONE FUNZIONI...............................................................................


  return (
    <div className="flex justify-center items-start pt-8 min-h-screen bg-gray-200">
      
      {error && (
  <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">
    <strong>Errore:</strong> {error}
  </div>
)}

 
 {/* Inizio Card Principale */}
 
 {/*
<div className="bg-gray-100 shadow-lg rounded-lg border-2 border-blue-400 w-[800px] h-[730px] md:h-auto p-4">
*/}
 <div className="bg-gray-100 shadow-lg rounded-lg border-2 border-blue-400 w-full max-w-[98%] md:max-w-[800px] mx-auto min-h-0 h-auto md:h-[780px] p-4">


<div className="flex flex-col justify-between flex-grow">
    <ButtonsLayout
      isStudentNameValid={isStudentNameValid}
      handleButtonClick={handleButtonClick}
      handleButtonWithPrintDialog={handleButtonWithPrintDialog}
      handleDownloadPDF={handleDownloadPDF}
      handlePrintWithoutAdding={handlePrintWithoutAdding}
      handleGenerateExcelForDate={handleGenerateExcelForDate}
    />
  </div>



        {/* Inizio Griglia Principale */}
       
	<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    
          {/* Inizio Colonna Sinistra */}
          <div className="w-full space-y-4">



{/* Card 2: Dati Alunno ................................................................................. */}
{/* Card Alunni */}
<div className="bg-gray-100 p-4 rounded-lg shadow-md border border-blue-300 order-2 md:order-2">

  {/* Titolo della Card */}
  <h2 className="text-base font-semibold text-gray-500 mb-1">Alunno</h2>
  
  {/* Griglia per etichette e valori */}
  <div className="grid grid-cols-[110px_auto] text-gray-700 mb-2">
    {/* INIZIO MODIFICA: Aumentata la distanza con mb-6 */}
    <p className="text-sm font-bold">Nome:</p>
    <p className="text-sm">{selectedAlunno?.nominativo || ""}</p>
    
    <p className="text-sm font-bold">Data Nascita:</p>
    <p className="text-sm">{selectedAlunno?.data_nascita ? formatDateForUI(selectedAlunno.data_nascita) : ""}</p>
    
    <p className="text-sm font-bold">Classe:</p>
    <p className="text-sm">{selectedAlunno?.classe || ""}</p>
    
    <p className="text-sm font-bold">Indirizzo:</p>
    <p className="text-sm">{selectedAlunno?.indirizzo_residenza || ""}</p>
    
    <p className="text-sm font-bold">Comune:</p>
    <p className="text-sm">{selectedAlunno?.comune_residenza || ""}</p>
    {/* FINE MODIFICA */}
  </div>




  {/* Dropdown per selezionare l'alunno .......................................................................*/}
  <div className="mt-4">
    
    <Select
      options={alunni.map((alunno) => ({
        value: alunno.id_alunno,
        label: `${alunno.nominativo} - ${alunno.classe}`,
      }))}
      value={alunni.find((alunno) => alunno.id_alunno === selectedAlunnoId) || null}
      onChange={(selectedOption) => setSelectedAlunnoId(selectedOption?.value || null)}
      isClearable
      placeholder="Cerca alunno..."
      className="w-full"
      menuPortalTarget={typeof window !== "undefined" ? document.body : null}
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        control: (base) => ({
          ...base,
          fontSize: "14px",
          backgroundColor: "#f7fee7", // Sfondo personalizzato
          borderColor: "#d1d5db", // Grigio medio
          boxShadow: "none",
          '&:hover': {
            borderColor: "#9ca3af", // Grigio scuro
          },
        }),
        menu: (base) => ({
          ...base,
          maxHeight: "300px",
          overflowY: "hidden",
          overflowX: "hidden",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }),
        option: (base, state) => ({
          ...base,
          fontSize: state.isFocused ? "13px" : "12px",
          lineHeight: "0.8",
          backgroundColor: state.isFocused ? "#f0f8ff" : "white",
          color: "black",
          cursor: "pointer",
        }),
      }}
      filterOption={(option, inputValue) => {
        const normalizedLabel = option.label.toLowerCase();
        const normalizedInput = inputValue.toLowerCase();
        return normalizedLabel.startsWith(normalizedInput);
      }}
    />
  
  
  
  
  </div>
  {/* Dropdown per selezionare l'alunno ...................................................................... */}





 

  {/* Dropdown per selezionare l'alunno in ritardo .............................................................
  <div className="mt-4">
    
  <Select
  options={alunniConRitardi.map((alunno) => ({
    value: alunno.id_alunno,
    label: `${alunno.nominativo} - ${alunno.classe}`,
  }))}
  value={alunniConRitardi.find((alunno) => alunno.id_alunno === selectedAlunnoId) || null}
  onChange={(selectedOption) => setSelectedAlunnoId(selectedOption?.value || null)}
  isClearable
  placeholder="Seleziona alunno con P* (senza bustina)"
  className="w-full"
  menuPortalTarget={typeof window !== "undefined" ? document.body : null}
  styles={{
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base) => ({
      ...base,
      fontSize: "14px",
      backgroundColor: "#E6E6FA",
      borderColor: "#d1d5db",
      boxShadow: "none",
      '&:hover': {
        borderColor: "#9ca3af",
      },
    }),
    menu: (base) => ({
      ...base,
      maxHeight: "300px",
      overflowY: "hidden",
      overflowX: "hidden",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    }),
    option: (base, state) => ({
      ...base,
      fontSize: state.isFocused ? "13px" : "12px",
      lineHeight: "0.8",
      backgroundColor: state.isFocused ? "#f0f8ff" : "white",
      color: "black",
      cursor: "pointer",
    }),
  }}
/>
  
  
  
  
  </div>
  */}

  






</div>

{/* Card 2: CARD ALUNNI Dati Alunno ................................................................................. */}


{/* CARD RITARDI..................................................................................................... */}

<div className="bg-[#fffbeb] shadow-md rounded-lg p-4 border border-blue-300 order-4 md:order-4">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-base font-semibold text-gray-500">Ritardi</h2>
    {/* Contenitore Pulsanti */}
    <div className="flex gap-2">     
      {/* Pulsanti */}    
      {/* Pulsante per cancellare l'ultimo ritardo */}
      <button
        onClick={() => {
          Swal.fire({
            title: "Sei sicuro?",
            text: "Vuoi davvero cancellare l'ultimo ritardo inserito?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sì, cancella",
            cancelButtonText: "Annulla",
            buttonsStyling: true,
          }).then((result) => {
            if (result.isConfirmed) {
              handleDeleteLastRitardo();
              Swal.fire("Cancellato!", "L'ultimo ritardo è stato cancellato.", "success");
            }
          });
        }}
        className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
        aria-label="Cancella ultimo ritardo"
        title="Cancella l'ultimo ritardo inserito"
      >
        <HiOutlineTrash className="w-4 h-4" />
      </button>

      {/* Pulsante per modificare la data */}
<button
  onClick={async () => {
    const ritardoID = await Swal.fire({
      title: "Modifica data ritardo",
      text: "Inserisci l'ID del ritardo da modificare:",
      input: "number",
      showCancelButton: true,
      confirmButtonText: "Avanti",
    });

    if (ritardoID.value) {
      const ritardoDaModificare = getCombinedRitardi().find(
        (r) => r.id_ritardo === parseInt(ritardoID.value)
      );

      if (ritardoDaModificare) {
        const newDate = await Swal.fire({
          title: "Seleziona la nuova data",
          html: '<input type="date" id="newDate" class="swal2-input" />',
          preConfirm: () => document.getElementById("newDate").value,
        });

        if (newDate.value) {
          console.log("ID ritardo da aggiornare:", ritardoDaModificare.id_ritardo);
          await handleUpdateRitardoDate(ritardoDaModificare.id_ritardo, newDate.value);
          // Aggiungo un feedback di successo
          await Swal.fire({
            icon: 'success',
            title: 'Data aggiornata con successo',
            timer: 1500
          });
        }
      } else {
        Swal.fire("Errore", "ID ritardo non trovato.", "error");
      }
    }
  }}
  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
  aria-label="Modifica data ritardo"
  title="Modifica la data del ritardo"
>
  <HiOutlinePencil className="w-4 h-4" />
</button>

      {/* Pulsante per modificare l'orario */}
<button
  onClick={async () => {
    const ritardoID = await Swal.fire({
      title: "Modifica orario ritardo",
      text: "Inserisci l'ID del ritardo da modificare:",
      input: "number",
      showCancelButton: true,
      confirmButtonText: "Avanti",
    });

    if (ritardoID.value) {
      const ritardoDaModificare = getCombinedRitardi().find(
        (r) => r.id_ritardo === parseInt(ritardoID.value)
      );

      if (ritardoDaModificare) {
        const newTime = await Swal.fire({
          title: "Seleziona il nuovo orario",
          html: '<input type="time" id="newTime" class="swal2-input" />',
          preConfirm: () => document.getElementById("newTime").value,
        });

        if (newTime.value) {
          console.log("ID ritardo da aggiornare:", ritardoDaModificare.id_ritardo);
          await handleUpdateRitardoOra(ritardoDaModificare.id_ritardo, newTime.value);
          // Aggiungo feedback di successo
          await Swal.fire({
            icon: 'success',
            title: 'Orario aggiornato con successo',
            timer: 1500
          });
        }
      } else {
        Swal.fire("Errore", "ID ritardo non trovato.", "error");
      }
    }
  }}
  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
  aria-label="Modifica orario ritardo"
  title="Modifica l'orario del ritardo"
>
  <HiOutlineClock className="w-4 h-4" />
</button>

      {/* Pulsante per modificare la motivazione */}
      <button
        onClick={async () => {
          const ritardoID = await Swal.fire({
            title: "Modifica motivazione ritardo",
            text: "Inserisci l'ID del ritardo da modificare:",
            input: "number",
            showCancelButton: true,
            confirmButtonText: "Avanti",
          });

          if (ritardoID.value) {
            const ritardoDaModificare = getCombinedRitardi().find(
              (r) => r.id_ritardo === parseInt(ritardoID.value)
            );

            if (ritardoDaModificare) {
              const motivazioni = {
                Personale: "Personale",
                Trasporto: "Trasporto",
                Malattia: "Malattia",
                Sport: "Sport",
              };

              const { value: newMotivazione } = await Swal.fire({
                title: "Seleziona una nuova motivazione",
                input: "select",
                inputOptions: motivazioni,
                inputPlaceholder: "Seleziona una motivazione",
                showCancelButton: true,
                confirmButtonText: "Salva",
                cancelButtonText: "Annulla",
              });

              if (newMotivazione) {
                console.log("ID ritardo da aggiornare:", ritardoDaModificare.id_ritardo);
                await handleUpdateRitardoMotivazione(ritardoDaModificare.id_ritardo, newMotivazione);
              }
            } else {
              Swal.fire("Errore", "ID ritardo non trovato.", "error");
            }
          }
        }}
        className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
        aria-label="Modifica motivazione ritardo"
        title="Modifica la motivazione del ritardo"
      >
        <HiOutlineChatBubbleOvalLeft className="w-4 h-4" />
      </button>

      {/* Pulsante per modificare "Personale*" in "Personale" 
      <button
        onClick={async () => {
          const ritardoID = await Swal.fire({
            title: "Modifica 'Personale*' in 'Personale'",
            text: "Inserisci l'ID del ritardo da modificare:",
            input: "number",
            showCancelButton: true,
            confirmButtonText: "Avanti",
          });

          if (ritardoID.value) {
            const ritardoIDVal = parseInt(ritardoID.trim());
            if (!isNaN(ritardoIDVal)) {
              await handleUpdatePersonaleStarToPersonale(ritardoIDVal, "Personale");
              Swal.fire("Successo", "Motivazione aggiornata a 'Personale'.", "success");
            } else {
              Swal.fire("Errore", "ID ritardo non valido.", "error");
            }
          }
        }}
        className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
        aria-label="Modifica 'Personale*' in 'Personale'"
      >
        <HiOutlineDocumentCheck className="w-4 h-4" />
      </button>
      */}

      <button
  onClick={async () => {
    const result = await Swal.fire({
      title: "Conferma",
      text: "Vuoi giustificare tutti i ritardi con motivazione 'Personale*'?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sì, giustifica",
      cancelButtonText: "Annulla",
    });

    if (result.isConfirmed) {
      handleUpdatePersonaleStarToPersonale(); // Chiama la funzione per aggiornare i ritardi
    }
  }}
  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
  aria-label="Modifica 'Personale*' in 'Personale'"
  title="Giustifica tutti i ritardi con motivazione 'Personale*'"
>
  <HiOutlineDocumentCheck className="w-4 h-4" />
</button>

 {/* Pulsante per avvenuto invio mail */}
<button
  onClick={async () => {
    const { value: ritardoID } = await Swal.fire({
      title: "Inserisci il numero del ritardo",
      input: "number",
      inputLabel: "ID Ritardo",
      inputPlaceholder: "Inserisci l'ID del ritardo",
      showCancelButton: true,
    });

    if (ritardoID) {
      const ritardoIDVal = parseInt(ritardoID.trim());
      if (!isNaN(ritardoIDVal)) {
        await handleUpdateEmailInviata(ritardoIDVal);
      } else {
        Swal.fire("Errore", "ID ritardo non valido.", "error");
      }
    }
  }}
  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
  aria-label="Aggiungi bustina verde"
  title="Aggiungi bustina verde al ritardo"
>
  <HiOutlineMail className="w-4 h-4 text-gray-500" />
</button>


{/* Pulsante per rimuovere bustina verde */}
<button
  onClick={async () => {
    const { value: ritardoID } = await Swal.fire({
      title: "Inserisci il numero del ritardo",
      input: "number",
      inputLabel: "ID Ritardo",
      inputPlaceholder: "Inserisci l'ID del ritardo",
      showCancelButton: true,
    });

    if (ritardoID) {
      const ritardoIDVal = parseInt(ritardoID.trim());
      if (!isNaN(ritardoIDVal)) {
        await handleRemoveEmailInviata(ritardoIDVal);
      } else {
        Swal.fire("Errore", "ID ritardo non valido.", "error");
      }
    }
  }}
  className="bg-gray-200 hover:bg-gray-300 text-red-500 rounded-full p-1 flex items-center justify-center"
  aria-label="Rimuovi bustina verde"
  title="Rimuovi bustina verde dal ritardo"
>
  <HiOutlineMail className="w-4 h-4 text-red-500" />
</button>
      
    {/* Altri pulsanti possono essere aggiunti qui */}
  </div>
</div>




{/* Tabella dei ritardi */}
 
 
 {/* Tabella Ritardi */}
<div className="overflow-auto min-h-[212px] max-h-[212px] border border-gray-300 rounded-lg">
  
  {/* Intestazione della tabella */}
  <ul className="table-header sticky top-0 z-10">
    <li className="table-cell" style={{ width: "40px" }}>ID</li>
    <li className="table-cell" style={{ width: "40px" }}>N</li>
    <li className="table-cell" style={{ width: "80px" }}>Data</li>
    <li className="table-cell" style={{ width: "60px" }}>Ora</li>
    <li className="table-cell" style={{ width: "60px" }}>Motivo</li>
    <li className="table-cell" style={{ width: "50px" }}>Mail</li>
  </ul>

  {/* Corpo della tabella */}
  <ul className="divide-y divide-gray-300">
    {getCombinedRitardi().length > 0 ? (
      getCombinedRitardi().map((ritardo, index) => (
        <li key={ritardo.id_ritardo || index} className="table-row">
          <span className="table-cell" style={{ width: "40px" }}>
            {ritardo.id_ritardo || "-"}
          </span>
          <span className="table-cell" style={{ width: "40px" }}>
            {index + 1}
          </span>
          <span className="table-cell" style={{ width: "80px" }}>
            {ritardo.data ? ritardo.data.split("-").reverse().join(".") : "-"}
          </span>
          <span className="table-cell" style={{ width: "60px" }}>
            {ritardo.orario_ingresso ? ritardo.orario_ingresso.slice(0, 5) : "-"}
          </span>
          <span className={`table-cell ${ritardo.motivazione === 'P*' ? 'bg-red-100' : ''}`} style={{ width: "60px" }}>
            {ritardo.motivazione || "-"}
          </span>
          <span className="table-cell" style={{ width: "50px" }}>
            {ritardo.emailinviata && <HiOutlineMail className="text-green-500" />}
          </span>
        </li>
      ))
    ) : (
      <p className="text-gray-500 text-center py-2"></p>
    )}
  </ul>
</div>






{/* Riepilogo Ritardi - PieChartComponent */}
<div className="mt-4">
<PieChartComponent ritardi={ritardi} />
  </div>


</div>
{/* Tabella dei ritardi */}

{/* CARD RITARDI..................................................................................................... */}


          </div>
          {/* Fine Colonna Sinistra */}



  
          {/* Inizio Colonna Destra */}
<div className="space-y-4">



{/* Card COORDINATORE */}{/* Card COORDINATORE */}

<div className="bg-gray-100 p-4 rounded-lg shadow-md border border-blue-300 order-5 md:order-5">
  <h2 className="text-base font-semibold text-gray-500 mb-1 flex items-center justify-between">

    <span>Coordinatore</span>
       
        
<button

  // Nel pulsante email del coordinatore, sostituisci l'onClick con:


  onClick={async () => {
    try {
      // Prima chiedi conferma
      const result = await Swal.fire({
        title: "Conferma invio email",
        text: `Stai per inviare una email al coordinatore e ai genitori di ${selectedAlunno?.nominativo}. Vuoi procedere?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sì, invia",
        cancelButtonText: "Annulla"
      });

      // Se l'utente annulla, esci dalla funzione
      if (!result.isConfirmed) {
        return;
      }

      console.log("Inizio invio email - raccolta dati");
  
      // Raccolta degli indirizzi email
      const destinatari = new Set();
      const ccDestinatari = new Set();
  
      // Aggiungi il coordinatore
      const coordinatoreEmail = coordinatore?.email;
      if (coordinatoreEmail) destinatari.add(coordinatoreEmail);
  
      // Aggiungi il padre
      const padreEmail = genitori.find((g) => g.tipo === "Padre")?.email;
      if (padreEmail) destinatari.add(padreEmail);
  
      // Aggiungi la madre
      const madreEmail = genitori.find((g) => g.tipo === "Madre")?.email;
      if (madreEmail) destinatari.add(madreEmail);
  
      // Aggiungi per conoscenza l'ufficio accoglienza
      ccDestinatari.add("accoglienza@itiangioy.org");
  
      // Converti i Set in Array
      const destinatariArray = Array.from(destinatari);
      const ccDestinatariArray = Array.from(ccDestinatari);
  
      console.log("Destinatari:", destinatariArray);
      console.log("CC Destinatari:", ccDestinatariArray);
  
      // Controlla se ci sono destinatari principali
      if (destinatariArray.length === 0) {
        Swal.fire("Errore", "Nessun destinatario valido trovato.", "error");
        return;
      }
  
      // Genera il PDF
      console.log("Generazione del PDF...");
      const studentData = {
        ...selectedAlunno,
        ritardi: getCombinedRitardi(),
      };
  
      const pdfBlob = await pdf(<GeneratePDFDocument student={studentData} type="report" />).toBlob();
      
      // Converti il blob in base64
      const reader = new FileReader();
      const pdfBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });
  
      const emailMessage = `
  Gent.mo Coordinatore,
  Gent.mi Genitori,
  con la presente desideriamo informarVi che l'alunno indicato ha superato il limite di ritardi per motivi personali consentito dal Regolamento d'Istituto.
  Vi invitiamo, ciascuno nell'ambito delle proprie competenze, a mettere in atto le misure che riterrete più opportune affinché l'alunno possa rispettare gli orari scolastici e giungere puntualmente a scuola.
  Si ricorda inoltre che, come previsto dal Regolamento, al raggiungimento di tre ritardi per motivi personali è necessario che i genitori provvedano alla giustificazione presso l'Ufficio Accoglienza. Si evidenzia, altresì, che l'elevato numero di ritardi potrebbe influire negativamente sul voto di condotta, con conseguenze sull'andamento scolastico complessivo dell'alunno.
  Confidando nella Vostra collaborazione, auspichiamo che l'impegno congiunto di tutte le parti coinvolte contribuisca positivamente al miglioramento del percorso educativo e didattico dell'alunno. 
  Cordiali saluti,
  Ufficio Accoglienza
  Prof.ssa Angioy F. – Prof.ssa Vannini M. G. – Prof. Cherchi N. – Prof. Usai G.
  `;
  
      console.log("Messaggio email:", emailMessage);
  
      // Prima della chiamata fetch
      console.log('=== INVIO EMAIL ===');
      console.log('Environment:', process.env.NODE_ENV);
      
      
      
      
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: destinatariArray.join(","),
          cc: ccDestinatariArray.join(","),
          subject: `Superamento del limite di ritardi consentiti - ${selectedAlunno?.nominativo || "N/D"} [${selectedAlunno?.classe || "Classe non specificata"}]`,
          message: emailMessage,
          attachment: {
            content: pdfBase64,
            filename: `Ritardi_${selectedAlunno?.nominativo || "alunno"}.pdf`,
            type: 'application/pdf'
          }
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Errore durante l'invio:", errorText);
        throw new Error(errorText);
      }
  
      const responseData = await response.json();
      
      if (responseData.success) {
        // Verifica se esiste un ritardo per la data odierna
        const dataOdierna = new Date().toISOString().split("T")[0];
        const { data: ritardi, error } = await supabase
          .from("ritardi")
          .select("*")
          .eq("data", dataOdierna)
          .eq("id_alunno", selectedAlunno?.id_alunno);

        if (error || !ritardi.length) {
          Swal.fire("Errore", "Nessun ritardo trovato per la data odierna.", "error");
          return;
        }

        // Aggiungi la bustina verde
        const ritardoID = ritardi[0].id_ritardo; // Prendi il primo ritardo trovato
        
        // Aggiorna il database
        await handleUpdateEmailInviata(ritardoID);
        
        // Aggiorna lo stato locale
        setRitardi(prevRitardi => 
          prevRitardi.map(ritardo => 
            ritardo.id_ritardo === ritardoID 
              ? { ...ritardo, emailinviata: true }
              : ritardo
          )
        );

        Swal.fire('Successo', 'Email inviata e bustina verde aggiunta con successo!', 'success');
      } else {
        throw new Error(responseData.error || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('Errore completo:', error);
      Swal.fire('Errore', 'Si è verificato un problema con l\'invio dell\'email.', 'error');
    }
  }}
  






  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
  aria-label="Invia email al coordinatore e Ufficio Accoglienza"
  title="Invia email al coordinatore e Ufficio Accoglienza"
>
  <HiOutlineMail className="w-4 h-4 text-gray-500" />
</button>


  </h2>
  <div className="grid grid-cols-[110px_auto] text-gray-700">
    <p className="text-sm font-bold">Nome:</p>
    <p className="text-sm">{coordinatore?.cognome || ""} {coordinatore?.nome || ""}</p>
    <p className="text-sm font-bold">Email:</p>
    <p className="text-sm">{coordinatore?.email || ""}</p>
    <p className="text-sm font-bold">Cellulare:</p>
    <p className="text-sm mb-0">{coordinatore?.cellulare || ""}</p>
  </div>
</div>

{/* Card COORDINATORE */}



{/* Card Genitori ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^*/}
{/* Card Genitori ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^*/}
<div className="bg-gray-100 shadow-md rounded-lg p-4 border border-blue-300">

  <h2 className="text-base font-semibold text-gray-500 mb-1">Genitori</h2>
  <div>
    {["Padre", "Madre"].map((tipo, index) => {
      const genitore = genitori.find((g) => g.tipo === tipo) || {};
      return (
        <div
          key={index}
          className={index === 1 ? "" : "mb-4"} // Rimuovi margine solo all'ultimo blocco
        >
          <h3 className="text-sm font-semibold text-blue-500">{tipo}</h3>
          <div className="grid grid-cols-[110px_auto] text-gray-700">
            <p className="text-sm font-bold">Nome:</p>
            <p className="text-sm">{genitore.cognome || ""} {genitore.nome || ""}</p>
            <p className="text-sm font-bold">Email:</p>
            <p className="text-sm">{genitore.email || ""}</p>
            <p className="text-sm font-bold">Cellulare 1:</p>
            <p className="text-sm">{genitore.cellulare1 || ""}</p>
            <p className="text-sm font-bold">Cellulare 2:</p>
            <p className="text-sm">{genitore.cellulare2 || ""}</p>
          </div>
        </div>
      );
    })}
  </div>
</div>

{/* Card Genitori ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^*/}


{/* Card Monitoraggio Ritardi Odierni */}
<div className="bg-gray-100 shadow-md rounded-lg p-4 border border-blue-300 order-7 md:order-7 h-[218px]">
  {/* Titolo della Card con Pulsante */}
  <h2 className="text-base font-semibold text-gray-500 mb-4 flex items-center justify-between">
    <span>Monitoraggio Ritardi Odierni</span>
    <button
      onClick={async () => {
        const today = new Date().toISOString().split("T")[0]; // Data odierna in formato ISO
        try {
          const { data, error } = await supabase
            .from("ritardi")
            .select(`
              orario_ingresso,
              motivazione,
              alunni ( cognome, nome, classi ( nome_classe ) )
            `)
            .eq("data", today);

          if (error) throw error;

          if (!data || data.length === 0) {
            Swal.fire("Nessun ritardo", "Non ci sono ritardi registrati oggi.", "info");
            setRitardiOdierni([]); // Resetta lo stato
          } else {
            const ritardiDiOggi = data.map((ritardo, index) => ({
              numero: index + 1,
              nominativo: `${ritardo.alunni?.cognome || ""} ${ritardo.alunni?.nome || ""}`.trim(),
              classe: ritardo.alunni?.classi?.nome_classe || "N/D",
              orario: ritardo.orario_ingresso?.slice(0, 5) || "N/D",
              motivo: ritardo.motivazione || "N/D",
            }));
            setRitardiOdierni(ritardiDiOggi);
          }
        } catch (error) {
          console.error("Errore nel recupero dei ritardi odierni:", error.message);
          Swal.fire("Errore", "Impossibile recuperare i dati dei ritardi odierni.", "error");
        }
      }}
      className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-1 flex items-center justify-center"
      aria-label="Mostra ritardi odierni"
      title="Mostra i ritardi odierni"
    >
      <HiBarsArrowUp className="w-4 h-4 text-gray-500" />
    </button>
  </h2>

  {/* Tabella dei Ritardi Odierni */}
  <div className="overflow-auto border border-gray-300 rounded-lg h-[148px]">
    {/* Intestazione della tabella */}
    <ul className="table-header sticky top-0 z-10">
      {[
        { width: "30px", label: "N" },
        { width: "150px", label: "Nome" },
        { width: "50px", label: "Classe" },
        { width: "45px", label: "Ora" },
        { width: "45px", label: "Motivo" },
      ].map((header, idx) => (
        <li
          key={idx}
          className={`table-cell ${idx !== 0 ? "border-l border-gray-300" : ""}`}
          style={{ width: header.width }}
        >
          {header.label}
        </li>
      ))}
    </ul>

    {/* Corpo della tabella */}
    <ul className="divide-y divide-gray-300">
      {ritardiOdierni.length > 0 ? (
        ritardiOdierni.map((ritardo, index) => (
          <li key={index} className="table-row">
            {[
              { width: "30px", value: ritardo.numero },
              {
                width: "150px",
                value: ritardo.nominativo,
                className: "table-cell-left table-cell-truncate" // Aggiungi classe per troncare il testo lungo
              },
              { width: "50px", value: ritardo.classe },
              { width: "45px", value: ritardo.orario },
              { 
                width: "45px", 
                value: ritardo.motivo,
                className: ritardo.motivo === 'P*' ? 'bg-red-100' : ''
              }
            ].map((column, idx) => (
              <span
                key={idx}
                className={`table-cell ${column.className || ""} ${
                  idx !== 0 ? "border-l border-gray-300" : ""
                }`}
                style={{ width: column.width }}
              >
                {column.value}
              </span>
            ))}
          </li>
        ))
      ) : (
        <p className="text-gray-500 text-center py-2"></p>
      )}
    </ul>
  </div>
</div>


</div>
{/* Fine Colonna Destra */}

        </div>
        {/* Fine Griglia Principale */}
      
      
        <div className="mt-4 text-xs text-gray-500 flex items-center justify-center gap-2">
        <Image 
          src="/images/logogug.png" 
          alt="WiGu Logo" 
          width={16}
          height={16}
          className="object-contain"
        />
        Design & Development by <span className="font-semibold text-blue-600">WiGu</span>
      </div>
          
      
      </div>   
    
     {/* Fine Card Principale */}
       
    
    
    </div>
  );
};




export default MainLayout;
