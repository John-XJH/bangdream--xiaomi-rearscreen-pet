package org.anon.companion;
import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;
public class DiagnosticProvider extends ContentProvider {
 @Override public boolean onCreate(){return true;}
 private File file(Uri u)throws FileNotFoundException{if(!"org.anon.companion.diagnostics".equals(u.getAuthority())||u.getPathSegments().size()!=2||!"exports".equals(u.getPathSegments().get(0))||!u.getLastPathSegment().matches("report-[0-9]+\\.zip"))throw new FileNotFoundException();File parent=new File(getContext().getCacheDir(),"diagnostic-exports"),f=new File(parent,u.getLastPathSegment());try{if(!f.getCanonicalFile().getParentFile().equals(parent.getCanonicalFile())||!f.isFile())throw new FileNotFoundException();}catch(IOException e){throw new FileNotFoundException();}return f;}
 @Override public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("Read only");return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.MODE_READ_ONLY);}
 @Override public Cursor query(Uri u,String[] projection,String selection,String[] args,String order){try{File f=file(u);MatrixCursor c=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});c.addRow(new Object[]{f.getName(),f.length()});return c;}catch(Exception e){return null;}}
 @Override public String getType(Uri u){return "application/zip";}
 @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
 @Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
 @Override public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
